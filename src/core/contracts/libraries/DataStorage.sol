// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import './FullMath.sol';

/// @title DataStorage
/// @notice Provides price, liquidity, volatility data useful for a wide variety of system designs
/// @dev Instances of stored dataStorage data, "timepoints", are collected in the dataStorage array
/// Timepoints are overwritten when the full length of the dataStorage array is populated.
/// The most recent timepoint is available by passing 0 to getSingleTimepoint()
library DataStorage {
    uint32 public constant WINDOW = 1 days;
    struct Timepoint {
        // whether or not the timepoint is initialized
        bool initialized;
        // the block timestamp of the timepoint
        uint32 blockTimestamp;
        // the tick accumulator, i.e. tick * time elapsed since the pool was first initialized
        int56 tickCumulative;
        // the seconds per liquidity, i.e. seconds elapsed / max(1, liquidity) since the pool was first initialized
        uint160 secondsPerLiquidityCumulative;
        // the volatility accumulator
        uint112 volatilityCumulative;
        // the gmean(volumes)/liquidity accumulator
        uint144 volumePerLiquidityCumulative;
    }

    /// @notice Transforms a previous timepoint into a new timepoint, given the passage of time and the current tick and liquidity values
    /// @dev blockTimestamp _must_ be chronologically equal to or greater than last.blockTimestamp, safe for 0 or 1 overflows
    /// @param last The specified timepoint to be used in creation of new timepoint
    /// @param blockTimestamp The timestamp of the new timepoint
    /// @param tick The active tick at the time of the new timepoint
    /// @param liquidity The total in-range liquidity at the time of the new timepoint
    /// @param averageTick The average tick at the time of the new timepoint
    /// @param volumePerLiquidity The gmean(volumes)/liquidity at the time of the new timepoint
    /// @return Timepoint The newly populated timepoint
    function createNewTimepoint(
        Timepoint memory last,
        uint32 blockTimestamp,
        int24 tick,
        uint128 liquidity,
        int24 averageTick,
        uint128 volumePerLiquidity
    ) private pure returns (Timepoint memory) {
        uint32 delta = blockTimestamp - last.blockTimestamp;

        last.initialized = true;
        last.blockTimestamp = blockTimestamp;
        last.tickCumulative += int56(tick) * delta;
        last.secondsPerLiquidityCumulative += ((uint160(delta) << 128) / (liquidity > 0 ? liquidity : 1));
        last.volatilityCumulative += uint112(int112(averageTick - tick)**2);
        last.volumePerLiquidityCumulative += volumePerLiquidity;

        return last;
    }

    /// @notice comparator for 32-bit timestamps
    /// @dev safe for 0 or 1 overflows, a and b _must_ be chronologically before or equal to currentTime
    /// @param a A comparison timestamp from which to determine the relative position of `currentTime`
    /// @param b From which to determine the relative position of `currentTime`
    /// @param currentTime A timestamp truncated to 32 bits
    /// @return res Whether `a` is chronologically <= `b`
    function lteConsideringOverflow(
        uint32 a,
        uint32 b,
        uint32 currentTime
    ) private pure returns (bool res) {
        res = (a > currentTime);

        if (res == b > currentTime) return a <= b; // if both are on the same side
        // otherwise need to return (a > currentTime)
    }

    function _getAverageTick(
        Timepoint[65535] storage self,
        uint32 time,
        int24 tick,
        uint16 index,
        uint16 oldestIndex,
        uint32 lastTimestamp,
        int56 lastTickCumulative
    ) private view returns (int24 avgTick) {
        uint32 oldestTimestamp = self[oldestIndex].blockTimestamp;
        int56 oldestTickCumulative = self[oldestIndex].tickCumulative;

        if (lteConsideringOverflow(oldestTimestamp, time - WINDOW, time)) {
            if (lteConsideringOverflow(lastTimestamp, time - WINDOW, time)) {
                index = index == 0 ? 65535 - 1 : index - 1;
                avgTick = self[index].initialized
                    ? int24(
                        (lastTickCumulative - self[index].tickCumulative) / (lastTimestamp - self[index].blockTimestamp)
                    )
                    : tick;
            } else {
                Timepoint memory startOfWindow = getSingleTimepoint(self, time, WINDOW, tick, index, oldestIndex, 0);

                //    current-WINDOW  last   current
                // _________*____________*_______*_
                //           ||||||||||||
                avgTick = int24((lastTickCumulative - startOfWindow.tickCumulative) / (lastTimestamp - time + WINDOW));
            }
        } else {
            avgTick = (lastTimestamp == oldestTimestamp)
                ? tick
                : int24((lastTickCumulative - oldestTickCumulative) / (lastTimestamp - oldestTimestamp));
        }
    }

    /// @notice Fetches the timepoints beforeOrAt and atOrAfter a target, i.e. where [beforeOrAt, atOrAfter] is satisfied.
    /// The result may be the same timepoint, or adjacent timepoints.
    /// @dev The answer must be contained in the array, used when the target is located within the stored timepoint
    /// boundaries: older than the most recent timepoint and younger, or the same age as, the oldest timepoint
    /// @param self The stored dataStorage array
    /// @param time The current block.timestamp
    /// @param target The timestamp at which the reserved timepoint should be for
    /// @param lastIndex The index of the timepoint that was most recently written to the timepoints array
    /// @param oldestIndex The index of the oldest timepoint in the timepoints array
    /// @return beforeOrAt The timepoint recorded before, or at, the target
    /// @return atOrAfter The timepoint recorded at, or after, the target
    function binarySearch(
        Timepoint[65535] storage self,
        uint32 time,
        uint32 target,
        uint16 lastIndex,
        uint16 oldestIndex
    ) private view returns (Timepoint storage beforeOrAt, Timepoint storage atOrAfter) {
        uint256 left = oldestIndex; // oldest timepoint
        uint256 right = lastIndex >= oldestIndex ? lastIndex : lastIndex + 65535; // newest timepoint considering overflow
        uint256 current = (left + right) / 2;

        beforeOrAt = self[current % 65535];
        atOrAfter = beforeOrAt; // will override in cycle

        while (true) {
            if (beforeOrAt.initialized) {
                // check if we've found the answer!
                if (lteConsideringOverflow(beforeOrAt.blockTimestamp, target, time)) {
                    atOrAfter = self[addmod(current, 1, 65535)];
                    if (lteConsideringOverflow(target, atOrAfter.blockTimestamp, time)) {
                        break;
                    }
                    left = current + 1;
                } else {
                    right = current - 1;
                }
            } else {
                // we've landed on an uninitialized timepoint, keep searching higher (more recently)
                left = current + 1;
            }
            current = (left + right) / 2;
            beforeOrAt = self[current % 65535];
        }
    }

    /// @dev Reverts if an timepoint at or before the desired timepoint timestamp does not exist.
    /// 0 may be passed as `secondsAgo' to return the current cumulative values.
    /// If called with a timestamp falling between two timepoints, returns the counterfactual accumulator values
    /// at exactly the timestamp between the two timepoints.
    /// @param self The stored dataStorage array
    /// @param self The oldest timepoint
    /// @param time The current block timestamp
    /// @param secondsAgo The amount of time to look back, in seconds, at which point to return an timepoint
    /// @param tick The current tick
    /// @param index The index of the timepoint that was most recently written to the timepoints array
    /// @param liquidity The current in-range pool liquidity
    function getSingleTimepoint(
        Timepoint[65535] storage self,
        uint32 time,
        uint32 secondsAgo,
        int24 tick,
        uint16 index,
        uint16 oldestIndex,
        uint128 liquidity
    ) internal view returns (Timepoint memory) {
        uint32 target = time - secondsAgo;

        // if target is newer than last timepoint
        if (secondsAgo == 0 || lteConsideringOverflow(self[index].blockTimestamp, target, time)) {
            Timepoint memory beforeOrAt = self[index];
            if (beforeOrAt.blockTimestamp == target) {
                return beforeOrAt;
            } else {
                // otherwise, we need to add new timepoint
                int24 avgTick = _getAverageTick(
                    self,
                    time,
                    tick,
                    index,
                    oldestIndex,
                    beforeOrAt.blockTimestamp,
                    beforeOrAt.tickCumulative
                );
                return createNewTimepoint(beforeOrAt, target, tick, liquidity, avgTick, 0);
            }
        }

        require(lteConsideringOverflow(self[oldestIndex].blockTimestamp, target, time), 'OLD');
        (Timepoint memory beforeOrAt, Timepoint memory atOrAfter) = binarySearch(
            self,
            time,
            target,
            index,
            oldestIndex
        );

        if (target == atOrAfter.blockTimestamp) {
            // we're at the right boundary
            return atOrAfter;
        }

        if (target != beforeOrAt.blockTimestamp) {
            // we're in the middle
            uint32 timepointTimeDelta = atOrAfter.blockTimestamp - beforeOrAt.blockTimestamp;
            uint32 targetDelta = target - beforeOrAt.blockTimestamp;

            beforeOrAt.tickCumulative +=
                ((atOrAfter.tickCumulative - beforeOrAt.tickCumulative) / timepointTimeDelta) *
                targetDelta;
            beforeOrAt.secondsPerLiquidityCumulative += uint160(
                (uint256(atOrAfter.secondsPerLiquidityCumulative - beforeOrAt.secondsPerLiquidityCumulative) *
                    targetDelta) / timepointTimeDelta
            );
            beforeOrAt.volatilityCumulative +=
                ((atOrAfter.volatilityCumulative - beforeOrAt.volatilityCumulative) / timepointTimeDelta) *
                targetDelta;
            beforeOrAt.volumePerLiquidityCumulative +=
                ((atOrAfter.volumePerLiquidityCumulative - beforeOrAt.volumePerLiquidityCumulative) /
                    timepointTimeDelta) *
                targetDelta;
        }

        // we're at the left boundary or at the middle
        return beforeOrAt;
    }

    /// @notice Returns the accumulator values as of each time seconds ago from the given time in the array of `secondsAgos`
    /// @dev Reverts if `secondsAgos` > oldest timepoint
    /// @param self The stored dataStorage array
    /// @param time The current block.timestamp
    /// @param secondsAgos Each amount of time to look back, in seconds, at which point to return an timepoint
    /// @param tick The current tick
    /// @param index The index of the timepoint that was most recently written to the timepoints array
    /// @param liquidity The current in-range pool liquidity
    /// @return tickCumulatives The tick * time elapsed since the pool was first initialized, as of each `secondsAgo`
    /// @return secondsPerLiquidityCumulatives The cumulative seconds / max(1, liquidity) since the pool was first initialized, as of each `secondsAgo`
    function getTimepoints(
        Timepoint[65535] storage self,
        uint32 time,
        uint32[] memory secondsAgos,
        int24 tick,
        uint16 index,
        uint128 liquidity
    )
        internal
        view
        returns (
            int56[] memory tickCumulatives,
            uint160[] memory secondsPerLiquidityCumulatives,
            uint112[] memory volatilityCumulatives,
            uint256[] memory volumePerAvgLiquiditys
        )
    {
        tickCumulatives = new int56[](secondsAgos.length);
        secondsPerLiquidityCumulatives = new uint160[](secondsAgos.length);
        volatilityCumulatives = new uint112[](secondsAgos.length);
        volumePerAvgLiquiditys = new uint256[](secondsAgos.length);

        uint16 oldestIndex;
        // check if we have overflow in the past
        if (self[addmod(index, 1, 65535)].initialized) {
            oldestIndex = uint16(addmod(index, 1, 65535));
        }

        Timepoint memory current;
        for (uint256 i = 0; i < secondsAgos.length; i++) {
            current = getSingleTimepoint(self, time, secondsAgos[i], tick, index, oldestIndex, liquidity);
            (
                tickCumulatives[i],
                secondsPerLiquidityCumulatives[i],
                volatilityCumulatives[i],
                volumePerAvgLiquiditys[i]
            ) = (
                current.tickCumulative,
                current.secondsPerLiquidityCumulative,
                current.volatilityCumulative,
                current.volumePerLiquidityCumulative
            );
        }
    }

    /// @notice Returns average volatility in the range from time-WINDOW to time
    /// @param self The stored dataStorage array
    /// @param time The current block.timestamp
    /// @param tick The current tick
    /// @param index The index of the timepoint that was most recently written to the timepoints array
    /// @param liquidity The current in-range pool liquidity
    /// @return TWVolatilityAverage The average volatility in the recent range
    function getAverages(
        Timepoint[65535] storage self,
        uint32 time,
        int24 tick,
        uint16 index,
        uint128 liquidity
    ) internal view returns (uint112 TWVolatilityAverage, uint256 TWVolumePerLiqAverage) {
        uint16 oldestIndex;
        Timepoint storage oldest = self[0];
        if (self[addmod(index, 1, 65535)].initialized) {
            oldestIndex = uint16(addmod(index, 1, 65535));
            oldest = self[oldestIndex];
        }

        Timepoint memory endOfWindow = getSingleTimepoint(self, time, 0, tick, index, oldestIndex, liquidity);

        if (lteConsideringOverflow(oldest.blockTimestamp, time - WINDOW, time)) {
            Timepoint memory startOfWindow = getSingleTimepoint(
                self,
                time,
                WINDOW,
                tick,
                index,
                oldestIndex,
                liquidity
            );
            return (
                (endOfWindow.volatilityCumulative - startOfWindow.volatilityCumulative) / WINDOW,
                uint256((endOfWindow.volumePerLiquidityCumulative - startOfWindow.volumePerLiquidityCumulative))
            );
        } else {
            return ((endOfWindow.volatilityCumulative) / WINDOW, uint256((endOfWindow.volumePerLiquidityCumulative)));
        }
    }

    /// @notice Initialize the dataStorage array by writing the first slot. Called once for the lifecycle of the timepoints array
    /// @param self The stored dataStorage array
    /// @param time The time of the dataStorage initialization, via block.timestamp truncated to uint32
    function initialize(Timepoint[65535] storage self, uint32 time) internal {
        self[0] = Timepoint({
            initialized: true,
            blockTimestamp: time,
            tickCumulative: 0,
            secondsPerLiquidityCumulative: 0,
            volatilityCumulative: 0,
            volumePerLiquidityCumulative: 0
        });
    }

    /// @notice Writes an dataStorage timepoint to the array
    /// @dev Writable at most once per block. Index represents the most recently written element. index must be tracked externally.
    /// @param self The stored dataStorage array
    /// @param index The index of the timepoint that was most recently written to the timepoints array
    /// @param blockTimestamp The timestamp of the new timepoint
    /// @param tick The active tick at the time of the new timepoint
    /// @param liquidity The total in-range liquidity at the time of the new timepoint
    /// @param volumePerLiquidity The gmean(volumes)/liquidity at the time of the new timepoint
    /// @return indexUpdated The new index of the most recently written element in the dataStorage array
    function write(
        Timepoint[65535] storage self,
        uint16 index,
        uint32 blockTimestamp,
        int24 tick,
        uint128 liquidity,
        uint128 volumePerLiquidity
    ) internal returns (uint16 indexUpdated) {
        // early return if we've already written an timepoint this block
        if (self[index].blockTimestamp == blockTimestamp) {
            return index;
        }
        Timepoint memory last = self[index];

        // get next index considering overflow
        indexUpdated = uint16(addmod(index, 1, 65535));

        uint16 oldestIndex;
        // check if we have overflow in the past
        if (self[indexUpdated].initialized) {
            oldestIndex = indexUpdated;
        }

        int24 avgTick = _getAverageTick(
            self,
            blockTimestamp,
            tick,
            index,
            oldestIndex,
            last.blockTimestamp,
            last.tickCumulative
        );
        self[indexUpdated] = createNewTimepoint(last, blockTimestamp, tick, liquidity, avgTick, volumePerLiquidity);
    }
}
