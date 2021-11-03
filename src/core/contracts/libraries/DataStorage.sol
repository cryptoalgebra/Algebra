// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

import './FullMath.sol';

/// @title DataStorage
/// @notice Provides price and liquidity data useful for a wide variety of system designs
/// @dev Instances of stored dataStorage data, "timepoints", are collected in the dataStorage array
/// Every pool is initialized with an dataStorage array length of 1. Anyone can pay the SSTOREs to increase the
/// maximum length of the dataStorage array. New slots will be added when the array is fully populated.
/// Timepoints are overwritten when the full length of the dataStorage array is populated.
/// The most recent timepoint is available, independent of the length of the dataStorage array, by passing 0 to getTimepoints()
library DataStorage {
    uint32 public constant WINDOW = 24 * 60 * 60;
    struct Timepoint {
        // whether or not the timepoint is initialized
        bool initialized;
        // the block timestamp of the timepoint
        uint32 blockTimestamp;
        // the tick accumulator, i.e. tick * time elapsed since the pool was first initialized
        int56 tickCumulative;
        // the seconds per liquidity, i.e. seconds elapsed / max(1, liquidity) since the pool was first initialized
        uint160 secondsPerLiquidityCumulative;
        uint112 volatilityCumulative;
        uint144 volumePerLiquidityCumulative;
    }

    /// @notice Transforms a previous timepoint into a new timepoint, given the passage of time and the current tick and liquidity values
    /// @dev blockTimestamp _must_ be chronologically equal to or greater than last.blockTimestamp, safe for 0 or 1 overflows
    /// @param last The specified timepoint to be used in creation of new timepoint
    /// @param blockTimestamp The timestamp of the new timepoint
    /// @param tick The active tick at the time of the new timepoint
    /// @param liquidity The total in-range liquidity at the time of the new timepoint
    /// @return Timepoint The newly populated timepoint
    //TODO: doc
    function createNewTimepoint(
        Timepoint memory last,
        uint32 blockTimestamp,
        int24 tick,
        uint128 liquidity,
        int24 averageTick,
        uint128 volumePerLiquidity
    ) private pure returns (Timepoint memory) {
        uint32 delta = blockTimestamp - last.blockTimestamp;

        return
            Timepoint({
                initialized: true,
                blockTimestamp: blockTimestamp,
                tickCumulative: last.tickCumulative + int56(tick) * delta,
                secondsPerLiquidityCumulative: last.secondsPerLiquidityCumulative +
                    ((uint160(delta) << 128) / (liquidity > 0 ? liquidity : 1)),
                volatilityCumulative: last.volatilityCumulative + uint112(int112(averageTick - tick)**2),
                volumePerLiquidityCumulative: last.volumePerLiquidityCumulative + volumePerLiquidity
            });
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

    function _averages(
        Timepoint[65535] storage self,
        uint32 time,
        int24 tick,
        uint16 index,
        uint128 liquidity
    ) private view returns (int24 avgTick) {
        Timepoint memory last = self[index];

        Timepoint storage oldest = self[addmod(index, 1, 65535)];
        if (!oldest.initialized) oldest = self[0];

        if (lteConsideringOverflow(oldest.blockTimestamp, time - WINDOW, time)) {
            if (!lteConsideringOverflow(last.blockTimestamp, time - WINDOW, time)) {
                (int56 bTick, , , ) = getSingleTimepoint(
                    self,
                    time,
                    WINDOW,
                    tick,
                    index,
                    liquidity //TODO:MB last - WINDOW?
                );
                //    current-WINDOW  last   current
                // _________*____________*_______*_
                //           ||||||||||||

                // May be we should do:
                //    last-WINDOW         last   current
                // _________*_________________*_______*_
                //           |||||||||||||||||
                avgTick = int24((last.tickCumulative - bTick) / (WINDOW + last.blockTimestamp - time));
            } else {
                index = index == 0 ? 65535 - 1 : index - 1;
                avgTick = self[index].initialized
                    ? int24(
                        (last.tickCumulative - self[index].tickCumulative) /
                            (last.blockTimestamp - self[index].blockTimestamp)
                    )
                    : tick;
            }
        } else {
            avgTick = (last.blockTimestamp == oldest.blockTimestamp)
                ? tick
                : int24((last.tickCumulative - oldest.tickCumulative) / (last.blockTimestamp - oldest.blockTimestamp));
        }
    }

    /// @notice Fetches the timepoints beforeOrAt and atOrAfter a target, i.e. where [beforeOrAt, atOrAfter] is satisfied.
    /// The result may be the same timepoint, or adjacent timepoints.
    /// @dev The answer must be contained in the array, used when the target is located within the stored timepoint
    /// boundaries: older than the most recent timepoint and younger, or the same age as, the oldest timepoint
    /// @param self The stored dataStorage array
    /// @param time The current block.timestamp
    /// @param target The timestamp at which the reserved timepoint should be for
    /// @param index The index of the timepoint that was most recently written to the timepoints array
    /// @return beforeOrAt The timepoint recorded before, or at, the target
    /// @return atOrAfter The timepoint recorded at, or after, the target
    function binarySearch(
        Timepoint[65535] storage self,
        uint32 time,
        uint32 target,
        uint16 index
    ) private view returns (Timepoint memory beforeOrAt, Timepoint memory atOrAfter) {
        uint256 l = addmod(index, 1, 65535); // oldest timepoint
        uint256 r = l + 65534; // newest timepoint
        uint256 i;
        uint256 currentTimepointNum;
        while (true) {
            i = (l + r) / 2;
            currentTimepointNum = i % 65535;
            (
                beforeOrAt.initialized,
                beforeOrAt.blockTimestamp,
                beforeOrAt.tickCumulative,
                beforeOrAt.secondsPerLiquidityCumulative
            ) = (
                self[currentTimepointNum].initialized,
                self[currentTimepointNum].blockTimestamp,
                self[currentTimepointNum].tickCumulative,
                self[currentTimepointNum].secondsPerLiquidityCumulative
            );

            // we've landed on an uninitialized tick, keep searching higher (more recently)
            if (!beforeOrAt.initialized) {
                l = i + 1;
                continue;
            }

            // check if we've found the answer!
            if (lteConsideringOverflow(beforeOrAt.blockTimestamp, target, time)) {
                atOrAfter.blockTimestamp = self[addmod(i, 1, 65535)].blockTimestamp;
                if (lteConsideringOverflow(target, atOrAfter.blockTimestamp, time)) {
                    beforeOrAt.volatilityCumulative = self[currentTimepointNum].volatilityCumulative;
                    beforeOrAt.volumePerLiquidityCumulative = self[currentTimepointNum].volumePerLiquidityCumulative;
                    atOrAfter = self[addmod(i, 1, 65535)];
                    break;
                }
                l = i + 1;
            } else {
                r = i - 1;
            }
        }
    }

    /// @notice Fetches the timepoints beforeOrAt and atOrAfter a given target, i.e. where [beforeOrAt, atOrAfter] is satisfied
    /// @dev Assumes there is at least 1 initialized timepoint.
    /// Used by getSingleTimepoint() to compute the counterfactual accumulator values as of a given block timestamp.
    /// @param self The stored dataStorage array
    /// @param time The current block.timestamp
    /// @param target The timestamp at which the reserved timepoint should be for
    /// @param tick The active tick at the time of the returned or simulated timepoint
    /// @param index The index of the timepoint that was most recently written to the timepoints array
    /// @param liquidity The total pool liquidity at the time of the call
    /// @return beforeOrAt The timepoint which occurred at, or before, the given timestamp
    /// @return atOrAfter The timepoint which occurred at, or after, the given timestamp
    function getSurroundingTimepoints(
        Timepoint[65535] storage self,
        uint32 time,
        uint32 target,
        int24 tick,
        uint16 index,
        uint128 liquidity
    ) private view returns (Timepoint memory beforeOrAt, Timepoint memory atOrAfter) {
        // if the target is chronologically at or after the newest timepoint, we can early return
        if (lteConsideringOverflow(self[index].blockTimestamp, target, time)) {
            beforeOrAt = self[index];
            if (beforeOrAt.blockTimestamp == target) {
                // if newest timepoint equals target, we're in the same block, so we can ignore atOrAfter
                return (beforeOrAt, atOrAfter);
            } else {
                int24 avgTick = _averages(self, time, tick, index, liquidity);
                // otherwise, we need to add new timepoint
                return (beforeOrAt, createNewTimepoint(beforeOrAt, target, tick, liquidity, avgTick, 0));
            }
        }

        // now, set before to the oldest timepoint

        if (!self[addmod(index, 1, 65535)].initialized) {
            beforeOrAt = self[0];
        } else {
            beforeOrAt = self[addmod(index, 1, 65535)];
        }

        // ensure that the target is chronologically at or after the oldest timepoint
        require(lteConsideringOverflow(beforeOrAt.blockTimestamp, target, time), 'OLD');

        // if we've reached this point, we have to binary search
        return binarySearch(self, time, target, index);
    }

    /// @dev Reverts if an timepoint at or before the desired timepoint timestamp does not exist.
    /// 0 may be passed as `secondsAgo' to return the current cumulative values.
    /// If called with a timestamp falling between two timepoints, returns the counterfactual accumulator values
    /// at exactly the timestamp between the two timepoints.
    /// @param self The stored dataStorage array
    /// @param time The current block timestamp
    /// @param secondsAgo The amount of time to look back, in seconds, at which point to return an timepoint
    /// @param tick The current tick
    /// @param index The index of the timepoint that was most recently written to the timepoints array
    /// @param liquidity The current in-range pool liquidity
    /// @return tickCumulative The tick * time elapsed since the pool was first initialized, as of `secondsAgo`
    /// @return secondsPerLiquidityCumulative The time elapsed / max(1, liquidity) since the pool was first initialized, as of `secondsAgo`
    function getSingleTimepoint(
        Timepoint[65535] storage self,
        uint32 time,
        uint32 secondsAgo,
        int24 tick,
        uint16 index,
        uint128 liquidity
    )
        internal
        view
        returns (
            int56 tickCumulative,
            uint160 secondsPerLiquidityCumulative,
            uint112 volatilityCumulative,
            uint256 volumePerLiquidityCumulative
        )
    {
        if (secondsAgo == 0) {
            Timepoint memory last = self[index];

            int24 avgTick = _averages(self, time, tick, index, liquidity);
            if (last.blockTimestamp != time) last = createNewTimepoint(last, time, tick, liquidity, avgTick, 0);
            return (
                last.tickCumulative,
                last.secondsPerLiquidityCumulative,
                last.volatilityCumulative,
                last.volumePerLiquidityCumulative
            );
        }

        uint32 target = time - secondsAgo;

        (Timepoint memory beforeOrAt, Timepoint memory atOrAfter) = getSurroundingTimepoints(
            self,
            time,
            target,
            tick,
            index,
            liquidity
        );

        if (target == beforeOrAt.blockTimestamp) {
            // we're at the left boundary
            return (
                beforeOrAt.tickCumulative,
                beforeOrAt.secondsPerLiquidityCumulative,
                beforeOrAt.volatilityCumulative,
                beforeOrAt.volumePerLiquidityCumulative
            );
        } else if (target == atOrAfter.blockTimestamp) {
            // we're at the right boundary
            return (
                atOrAfter.tickCumulative,
                atOrAfter.secondsPerLiquidityCumulative,
                atOrAfter.volatilityCumulative,
                atOrAfter.volumePerLiquidityCumulative
            );
        } else {
            // we're in the middle
            uint32 timepointTimeDelta = atOrAfter.blockTimestamp - beforeOrAt.blockTimestamp;
            uint32 targetDelta = target - beforeOrAt.blockTimestamp;
            return (
                beforeOrAt.tickCumulative +
                    ((atOrAfter.tickCumulative - beforeOrAt.tickCumulative) / timepointTimeDelta) *
                    targetDelta,
                beforeOrAt.secondsPerLiquidityCumulative +
                    uint160(
                        (uint256(atOrAfter.secondsPerLiquidityCumulative - beforeOrAt.secondsPerLiquidityCumulative) *
                            targetDelta) / timepointTimeDelta
                    ),
                beforeOrAt.volatilityCumulative +
                    ((atOrAfter.volatilityCumulative - beforeOrAt.volatilityCumulative) / timepointTimeDelta) *
                    targetDelta,
                beforeOrAt.volumePerLiquidityCumulative +
                    ((atOrAfter.volumePerLiquidityCumulative - beforeOrAt.volumePerLiquidityCumulative) /
                        timepointTimeDelta) *
                    targetDelta
            );
        }
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
        for (uint256 i = 0; i < secondsAgos.length; i++) {
            (
                tickCumulatives[i],
                secondsPerLiquidityCumulatives[i],
                volatilityCumulatives[i],
                volumePerAvgLiquiditys[i]
            ) = getSingleTimepoint(self, time, secondsAgos[i], tick, index, liquidity);
        }
    }

    /// @notice Returns average volatility in the range from time-WINDOW to time
    /// @dev if the oldest timepoint was written later than time-WINDOW returns 0 as average volatility
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
        Timepoint storage oldest = self[addmod(index, 1, 65535)];
        if (!oldest.initialized) oldest = self[0];
        (, , uint112 volatilityAfter, uint256 volumePerLiquidityCumulativeAfter) = getSingleTimepoint(
            self,
            time,
            0,
            tick,
            index,
            liquidity
        );
        if (lteConsideringOverflow(oldest.blockTimestamp, time - WINDOW, time)) {
            (, , uint112 volatilityBefore, uint256 volumePerLiquidityCumulativeBefore) = getSingleTimepoint(
                self,
                time,
                WINDOW,
                tick,
                index,
                liquidity
            );
            return (
                (volatilityAfter - volatilityBefore) / WINDOW,
                uint256((volumePerLiquidityCumulativeAfter - volumePerLiquidityCumulativeBefore))
            );
        } else {
            return ((volatilityAfter) / WINDOW, uint256((volumePerLiquidityCumulativeAfter)));
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
    /// If the index is at the end of the allowable array length (according to cardinality), and the next cardinality
    /// is greater than the current one, cardinality may be increased. This restriction is created to preserve ordering.
    /// @param self The stored dataStorage array
    /// @param index The index of the timepoint that was most recently written to the timepoints array
    /// @param blockTimestamp The timestamp of the new timepoint
    /// @param tick The active tick at the time of the new timepoint
    /// @param liquidity The total in-range liquidity at the time of the new timepoint
    /// @return indexUpdated The new index of the most recently written element in the dataStorage array
    function write(
        Timepoint[65535] storage self,
        uint16 index,
        uint32 blockTimestamp,
        int24 tick,
        uint128 liquidity,
        uint128 volumePerLiquidity
    ) internal returns (uint16 indexUpdated) {
        Timepoint storage last = self[index];

        // early return if we've already written an timepoint this block
        if (last.blockTimestamp == blockTimestamp) {
            return index;
        }

        indexUpdated = uint16(addmod(index, 1, 65535));
        int24 avgTick = _averages(self, blockTimestamp, tick, index, liquidity);
        self[indexUpdated] = createNewTimepoint(last, blockTimestamp, tick, liquidity, avgTick, volumePerLiquidity);
    }
}
