// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

/// @title DataStorage
/// @notice Provides price, liquidity, volatility data useful for a wide variety of system designs
/// @dev Instances of stored dataStorage data, "timepoints", are collected in the dataStorage array
/// Timepoints are overwritten when the full length of the dataStorage array is populated.
/// The most recent timepoint is available by passing 0 to getSingleTimepoint()
library DataStorage {
  uint32 internal constant WINDOW = 1 days;
  uint256 private constant UINT16_MODULO = 65536;
  struct Timepoint {
    bool initialized; // whether or not the timepoint is initialized
    uint32 blockTimestamp; // the block timestamp of the timepoint
    int56 tickCumulative; // the tick accumulator, i.e. tick * time elapsed since the pool was first initialized
    uint160 secondsPerLiquidityCumulative; // the seconds per liquidity since the pool was first initialized
    uint88 volatilityCumulative; // the volatility accumulator; overflow after ~34800 years is desired :)
    int24 averageTick; // average tick at this blockTimestamp
  }

  /// @notice Calculates volatility between two sequential timepoints with resampling to 1 sec frequency
  /// @param dt Timedelta between timepoints, must be within uint32 range
  /// @param tick0 The tick at the left timepoint, must be within int24 range
  /// @param tick1 The tick at the right timepoint, must be within int24 range
  /// @param avgTick0 The average tick at the left timepoint, must be within int24 range
  /// @param avgTick1 The average tick at the right timepoint, must be within int24 range
  /// @return volatility The volatility between two sequential timepoints
  /// If the requirements for the parameters are met, it always fits 88 bits
  function _volatilityOnRange(int256 dt, int256 tick0, int256 tick1, int256 avgTick0, int256 avgTick1) internal pure returns (uint256 volatility) {
    // On the time interval from the previous timepoint to the current
    // we can represent tick and average tick change as two straight lines:
    // tick = k*t + b, where k and b are some constants
    // avgTick = p*t + q, where p and q are some constants
    // we want to get sum of (tick(t) - avgTick(t))^2 for every t in the interval (0; dt]
    // so: (tick(t) - avgTick(t))^2 = ((k*t + b) - (p*t + q))^2 = (k-p)^2 * t^2 + 2(k-p)(b-q)t + (b-q)^2
    // since everything except t is a constant, we need to use progressions for t and t^2:
    // sum(t) for t from 1 to dt = dt*(dt + 1)/2 = sumOfSequence
    // sum(t^2) for t from 1 to dt = dt*(dt+1)*(2dt + 1)/6 = sumOfSquares
    // so result will be: (k-p)^2 * sumOfSquares + 2(k-p)(b-q)*sumOfSequence + dt*(b-q)^2
    int256 K = (tick1 - tick0) - (avgTick1 - avgTick0); // (k - p)*dt
    int256 B = (tick0 - avgTick0) * dt; // (b - q)*dt
    int256 sumOfSquares = (dt * (dt + 1) * (2 * dt + 1)); // sumOfSquares * 6
    int256 sumOfSequence = (dt * (dt + 1)); // sumOfSequence * 2
    volatility = uint256((K ** 2 * sumOfSquares + 6 * B * K * sumOfSequence + 6 * dt * B ** 2) / (6 * dt ** 2));
  }

  /// @notice Transforms a previous timepoint into a new timepoint, given the passage of time and the current tick and liquidity values
  /// @dev blockTimestamp _must_ be chronologically equal to or greater than last.blockTimestamp, safe for 0 or 1 overflows
  /// @param last The specified timepoint to be used in creation of new timepoint
  /// @param blockTimestamp The timestamp of the new timepoint
  /// @param tick The active tick at the time of the new timepoint
  /// @param prevTick The active tick at the time of the last timepoint
  /// @param liquidity The total in-range liquidity at the time of the new timepoint
  /// @param averageTick The average tick at the time of the new timepoint
  /// @return Timepoint The newly populated timepoint
  function createNewTimepoint(
    Timepoint memory last,
    uint32 blockTimestamp,
    int24 tick,
    int24 prevTick,
    uint128 liquidity,
    int24 averageTick
  ) private pure returns (Timepoint memory) {
    uint32 delta = blockTimestamp - last.blockTimestamp;

    last.initialized = true;
    last.blockTimestamp = blockTimestamp;
    last.tickCumulative += int56(tick) * delta;
    last.secondsPerLiquidityCumulative += ((uint160(delta) << 128) / (liquidity > 0 ? liquidity : 1)); // just timedelta if liquidity == 0
    last.volatilityCumulative += uint88(_volatilityOnRange(delta, prevTick, tick, last.averageTick, averageTick)); // always fits 88 bits
    last.averageTick = averageTick;

    return last;
  }

  /// @notice comparator for 32-bit timestamps
  /// @dev safe for 0 or 1 overflows, a and b _must_ be chronologically before or equal to currentTime
  /// @param a A comparison timestamp from which to determine the relative position of `currentTime`
  /// @param b From which to determine the relative position of `currentTime`
  /// @param currentTime A timestamp truncated to 32 bits
  /// @return res Whether `a` is chronologically <= `b`
  function lteConsideringOverflow(uint32 a, uint32 b, uint32 currentTime) private pure returns (bool res) {
    res = a > currentTime;
    if (res == b > currentTime) res = a <= b; // if both are on the same side
  }

  function getAvgAndPrevTick(
    Timepoint[UINT16_MODULO] storage self,
    uint32 time,
    int24 tick,
    uint16 lastIndex,
    uint16 oldestIndex,
    uint32 lastTimestamp,
    int56 lastTickCumulative
  ) internal view returns (int24 avgTick, int24 prevTick) {
    avgTick = int24(_getAverageTick(self, time, tick, lastIndex, oldestIndex, lastTimestamp, lastTickCumulative));
    prevTick = lastIndex == oldestIndex ? tick : _getPrevTick(self, lastIndex, lastTickCumulative, lastTimestamp);
  }

  /// @dev guaranteed that the result is within the bounds of int24
  /// returns int256 for fuzzy tests
  function _getAverageTick(
    Timepoint[UINT16_MODULO] storage self,
    uint32 time,
    int24 tick,
    uint16 lastIndex,
    uint16 oldestIndex,
    uint32 lastTimestamp,
    int56 lastTickCumulative
  ) internal view returns (int256 avgTick) {
    (uint32 oldestTimestamp, int56 oldestTickCumulative) = (self[oldestIndex].blockTimestamp, self[oldestIndex].tickCumulative);

    if (!lteConsideringOverflow(oldestTimestamp, time - WINDOW, time)) {
      // if oldest is newer than WINDOW ago
      return (lastTimestamp == oldestTimestamp) ? tick : (lastTickCumulative - oldestTickCumulative) / (lastTimestamp - oldestTimestamp);
    }

    if (lteConsideringOverflow(lastTimestamp, time - WINDOW, time)) {
      Timepoint storage _start = self[lastIndex - 1]; // considering underflow
      (bool initialized, uint32 startTimestamp, int56 startTickCumulative) = (_start.initialized, _start.blockTimestamp, _start.tickCumulative);
      avgTick = initialized ? (lastTickCumulative - startTickCumulative) / (lastTimestamp - startTimestamp) : tick;
    } else {
      int56 tickCumulativeAtStart = getTickCumulativeAt(self, time, WINDOW, tick, lastIndex, oldestIndex);

      //    current-WINDOW  last   current
      // _________*____________*_______*_
      //           ||||||||||||
      avgTick = (lastTickCumulative - tickCumulativeAtStart) / (lastTimestamp - time + WINDOW);
    }
  }

  function _getPrevTick(
    Timepoint[UINT16_MODULO] storage self,
    uint16 lastIndex,
    int56 lastTickCumulative,
    uint32 lastTimestamp
  ) internal view returns (int24 prevTick) {
    Timepoint storage _prevLast = self[lastIndex - 1]; // considering index underflow
    (uint32 _prevLastTimestamp, int56 _prevLastTickCumulative) = (_prevLast.blockTimestamp, _prevLast.tickCumulative);
    prevTick = int24((lastTickCumulative - _prevLastTickCumulative) / (lastTimestamp - _prevLastTimestamp));
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
    Timepoint[UINT16_MODULO] storage self,
    uint32 time,
    uint32 target,
    uint16 lastIndex,
    uint16 oldestIndex
  ) private view returns (Timepoint storage beforeOrAt, Timepoint storage atOrAfter) {
    uint256 left = oldestIndex; // oldest timepoint
    uint256 right = lastIndex < oldestIndex ? lastIndex + UINT16_MODULO : lastIndex; // newest timepoint considering one index overflow
    uint256 current = (left + right) >> 1; // "middle" point between the boundaries

    do {
      beforeOrAt = self[uint16(current)]; // checking the "middle" point between the boundaries
      (bool initializedBefore, uint32 timestampBefore) = (beforeOrAt.initialized, beforeOrAt.blockTimestamp);
      if (initializedBefore) {
        if (lteConsideringOverflow(timestampBefore, target, time)) {
          // is current point before or at `target`?
          atOrAfter = self[uint16(current + 1)]; // checking the next point after "middle"
          (bool initializedAfter, uint32 timestampAfter) = (atOrAfter.initialized, atOrAfter.blockTimestamp);
          if (initializedAfter) {
            if (lteConsideringOverflow(target, timestampAfter, time)) {
              // is the "next" point after or at `target`?
              return (beforeOrAt, atOrAfter); // the only fully correct way to finish
            }
            left = current + 1; // "next" point is before the `target`, so looking in the right half
          } else {
            // beforeOrAt is initialized and <= target, and next timepoint is uninitialized
            // should be impossible if initial boundaries and `target` are correct
            return (beforeOrAt, beforeOrAt);
          }
        } else {
          right = current - 1; // current point is after the `target`, so looking in the left half
        }
      } else {
        // we've landed on an uninitialized timepoint, keep searching higher
        // should be impossible if initial boundaries and `target` are correct
        left = current + 1;
      }
      current = (left + right) >> 1; // calculating the new "middle" point index after updating the bounds
    } while (true);

    atOrAfter = beforeOrAt; // code is unreachable, to suppress compiler warning
    assert(false); // code is unreachable, used for fuzzy testing
  }

  function getTimepointsAt(
    Timepoint[UINT16_MODULO] storage self,
    uint32 time,
    uint32 target,
    uint16 lastIndex,
    uint16 oldestIndex
  ) internal view returns (Timepoint storage beforeOrAt, Timepoint storage atOrAfter, bool isDifferent) {
    // if target is newer than last timepoint
    if (target == time || lteConsideringOverflow(self[lastIndex].blockTimestamp, target, time)) {
      return (self[lastIndex], self[lastIndex], false);
    }

    require(lteConsideringOverflow(self[oldestIndex].blockTimestamp, target, time), 'OLD');
    (beforeOrAt, atOrAfter) = binarySearch(self, time, target, lastIndex, oldestIndex);
    return (beforeOrAt, atOrAfter, true);
  }

  function getTickCumulativeAt(
    Timepoint[UINT16_MODULO] storage self,
    uint32 time,
    uint32 secondsAgo,
    int24 tick,
    uint16 lastIndex,
    uint16 oldestIndex
  ) internal view returns (int56 tickCumulative) {
    uint32 target = time - secondsAgo;
    (Timepoint storage beforeOrAt, Timepoint storage atOrAfter, bool isDifferent) = getTimepointsAt(self, time, target, lastIndex, oldestIndex);

    (uint32 timestampBefore, int56 tickCumulativeBefore) = (beforeOrAt.blockTimestamp, beforeOrAt.tickCumulative);
    if (target == timestampBefore) return tickCumulativeBefore; // we're at the left boundary
    if (!isDifferent) return (tickCumulativeBefore + int56(tick) * (target - timestampBefore)); // if target is newer than last timepoint

    (uint32 timestampAfter, int56 tickCumulativeAfter) = (atOrAfter.blockTimestamp, atOrAfter.tickCumulative);
    if (target == timestampAfter) return tickCumulativeAfter; // we're at the right boundary

    // we're in the middle
    (uint32 timepointTimeDelta, uint32 targetDelta) = (timestampAfter - timestampBefore, target - timestampBefore);
    return tickCumulativeBefore + ((tickCumulativeAfter - tickCumulativeBefore) / timepointTimeDelta) * targetDelta;
  }

  function getSecondsPerLiquidityCumulativeAt(
    Timepoint[UINT16_MODULO] storage self,
    uint32 time,
    uint32 secondsAgo,
    uint16 lastIndex,
    uint16 oldestIndex,
    uint128 liquidity
  ) internal view returns (uint160 secondsPerLiquidityCumulative) {
    uint32 target = time - secondsAgo;
    (Timepoint storage beforeOrAt, Timepoint storage atOrAfter, bool isDifferent) = getTimepointsAt(self, time, target, lastIndex, oldestIndex);

    (uint32 timestampBefore, uint160 secondsPerLiquidityCumulativeBefore) = (beforeOrAt.blockTimestamp, beforeOrAt.secondsPerLiquidityCumulative);
    if (target == timestampBefore) return secondsPerLiquidityCumulativeBefore; // we're at the left boundary
    if (!isDifferent) return (secondsPerLiquidityCumulativeBefore + ((uint160(target - timestampBefore) << 128) / (liquidity > 0 ? liquidity : 1))); // if target is newer than last timepoint

    (uint32 timestampAfter, uint160 secondsPerLiquidityCumulativeAfter) = (atOrAfter.blockTimestamp, atOrAfter.secondsPerLiquidityCumulative);
    if (target == timestampAfter) return secondsPerLiquidityCumulativeAfter; // we're at the right boundary

    // we're in the middle
    (uint32 timepointTimeDelta, uint32 targetDelta) = (timestampAfter - timestampBefore, target - timestampBefore);
    return
      secondsPerLiquidityCumulativeBefore +
      uint160((uint256(secondsPerLiquidityCumulativeAfter - secondsPerLiquidityCumulativeBefore) * targetDelta) / timepointTimeDelta);
  }

  function getVolatilityCumulativeAt(
    Timepoint[UINT16_MODULO] storage self,
    uint32 time,
    uint32 secondsAgo,
    int24 tick,
    uint16 lastIndex,
    uint16 oldestIndex
  ) internal view returns (uint88 volatilityCumulative) {
    (Timepoint memory beforeOrAt, Timepoint storage atOrAfter, bool isDifferent) = getTimepointsAt(
      self,
      time,
      time - secondsAgo,
      lastIndex,
      oldestIndex
    );

    if (time - secondsAgo == beforeOrAt.blockTimestamp) return beforeOrAt.volatilityCumulative; // we're at the left boundary
    if (!isDifferent) {
      // if target is newer than last timepoint
      (int24 avgTick, int24 prevTick) = getAvgAndPrevTick(
        self,
        time,
        tick,
        lastIndex,
        oldestIndex,
        beforeOrAt.blockTimestamp,
        beforeOrAt.tickCumulative
      );
      return (beforeOrAt.volatilityCumulative +
        uint88(_volatilityOnRange(time - secondsAgo - beforeOrAt.blockTimestamp, prevTick, tick, beforeOrAt.averageTick, avgTick)));
    }

    uint32 target = time - secondsAgo;

    (uint32 timestampAfter, uint88 volatilityCumulativeAfter) = (atOrAfter.blockTimestamp, atOrAfter.volatilityCumulative);
    if (target == timestampAfter) return volatilityCumulativeAfter; // we're at the right boundary

    // we're in the middle
    (uint32 timepointTimeDelta, uint32 targetDelta) = (timestampAfter - beforeOrAt.blockTimestamp, target - beforeOrAt.blockTimestamp);

    return beforeOrAt.volatilityCumulative + ((volatilityCumulativeAfter - beforeOrAt.volatilityCumulative) / timepointTimeDelta) * targetDelta;
  }

  /// @dev Reverts if a timepoint at or before the desired timepoint timestamp does not exist.
  /// 0 may be passed as `secondsAgo' to return the current cumulative values.
  /// If called with a timestamp falling between two timepoints, returns the counterfactual accumulator values
  /// at exactly the timestamp between the two timepoints.
  /// @param self The stored dataStorage array
  /// @param time The current block timestamp
  /// @param secondsAgo The amount of time to look back, in seconds, at which point to return a timepoint
  /// @param tick The current tick
  /// @param lastIndex The index of the timepoint that was most recently written to the timepoints array
  /// @param oldestIndex The index of the oldest timepoint
  /// @param liquidity The current in-range pool liquidity
  /// @return targetTimepoint desired timepoint or it's approximation
  function getSingleTimepoint(
    Timepoint[UINT16_MODULO] storage self,
    uint32 time,
    uint32 secondsAgo,
    int24 tick,
    uint16 lastIndex,
    uint16 oldestIndex,
    uint128 liquidity
  ) internal view returns (Timepoint memory targetTimepoint) {
    (Timepoint storage beforeOrAt, Timepoint storage atOrAfter, bool isDifferent) = getTimepointsAt(
      self,
      time,
      time - secondsAgo,
      lastIndex,
      oldestIndex
    );

    // TODO MEMORY
    targetTimepoint = beforeOrAt;
    if (time - secondsAgo == targetTimepoint.blockTimestamp) return targetTimepoint; // we're at the left boundary
    if (!isDifferent) {
      // if target is newer than last timepoint
      (int24 avgTick, int24 prevTick) = getAvgAndPrevTick(
        self,
        time,
        tick,
        lastIndex,
        oldestIndex,
        targetTimepoint.blockTimestamp,
        targetTimepoint.tickCumulative
      );
      return createNewTimepoint(targetTimepoint, time - secondsAgo, tick, prevTick, liquidity, avgTick);
    }

    uint32 target = time - secondsAgo;

    (uint32 timestampAfter, int56 tickCumulativeAfter) = (atOrAfter.blockTimestamp, atOrAfter.tickCumulative);
    if (target == timestampAfter) return atOrAfter; // we're at the right boundary

    // we're in the middle
    (uint32 timepointTimeDelta, uint32 targetDelta) = (timestampAfter - targetTimepoint.blockTimestamp, target - targetTimepoint.blockTimestamp);

    targetTimepoint.tickCumulative += ((tickCumulativeAfter - targetTimepoint.tickCumulative) / timepointTimeDelta) * targetDelta;
    targetTimepoint.secondsPerLiquidityCumulative += uint160(
      (uint256(atOrAfter.secondsPerLiquidityCumulative - targetTimepoint.secondsPerLiquidityCumulative) * targetDelta) / timepointTimeDelta
    );
    targetTimepoint.volatilityCumulative +=
      ((atOrAfter.volatilityCumulative - targetTimepoint.volatilityCumulative) / timepointTimeDelta) *
      targetDelta;
  }

  /// @notice Returns the accumulator values as of each time seconds ago from the given time in the array of `secondsAgos`
  /// @dev Reverts if `secondsAgos` > oldest timepoint
  /// @param self The stored dataStorage array
  /// @param time The current block.timestamp
  /// @param secondsAgos Each amount of time to look back, in seconds, at which point to return a timepoint
  /// @param tick The current tick
  /// @param lastIndex The index of the timepoint that was most recently written to the timepoints array
  /// @param liquidity The current in-range pool liquidity
  /// @return tickCumulatives The tick * time elapsed since the pool was first initialized, as of each `secondsAgo`
  /// @return secondsPerLiquidityCumulatives The cumulative seconds / max(1, liquidity) since the pool was first initialized, as of each `secondsAgo`
  /// @return volatilityCumulatives The cumulative volatility values since the pool was first initialized, as of each `secondsAgo`
  function getTimepoints(
    Timepoint[UINT16_MODULO] storage self,
    uint32 time,
    uint32[] memory secondsAgos,
    int24 tick,
    uint16 lastIndex,
    uint128 liquidity
  ) internal view returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulatives, uint112[] memory volatilityCumulatives) {
    uint256 secondsLength = secondsAgos.length;
    tickCumulatives = new int56[](secondsLength);
    secondsPerLiquidityCumulatives = new uint160[](secondsLength);
    volatilityCumulatives = new uint112[](secondsLength);

    uint16 oldestIndex = getOldestIndex(self, lastIndex);
    Timepoint memory current;
    for (uint256 i; i < secondsLength; ++i) {
      current = getSingleTimepoint(self, time, secondsAgos[i], tick, lastIndex, oldestIndex, liquidity);
      (tickCumulatives[i], secondsPerLiquidityCumulatives[i], volatilityCumulatives[i]) = (
        current.tickCumulative,
        current.secondsPerLiquidityCumulative,
        current.volatilityCumulative
      );
    }
  }

  //TODO
  function getOldestIndex(Timepoint[UINT16_MODULO] storage self, uint16 lastIndex) internal view returns (uint16 oldestIndex) {
    uint16 nextIndex = lastIndex + 1; // considering overflow
    if (self[nextIndex].initialized) oldestIndex = nextIndex; // check if we have overflow in the past
  }

  /// @notice Returns average volatility in the range from time-WINDOW to time
  /// @param self The stored dataStorage array
  /// @param time The current block.timestamp
  /// @param tick The current tick
  /// @param lastIndex The index of the timepoint that was most recently written to the timepoints array
  /// @param oldestIndex TODO
  /// @return volatilityAverage The average volatility in the recent range
  function getAverageVolatility(
    Timepoint[UINT16_MODULO] storage self,
    uint32 time,
    int24 tick,
    uint16 lastIndex,
    uint16 oldestIndex,
    uint88 lastCumulativeVolatility
  ) internal view returns (uint88 volatilityAverage) {
    Timepoint storage oldest = self[oldestIndex];
    uint32 oldestTimestamp = oldest.blockTimestamp;
    if (lteConsideringOverflow(oldestTimestamp, time - WINDOW, time)) {
      uint88 cumulativeVolatilityAtStart = getVolatilityCumulativeAt(self, time, WINDOW, tick, lastIndex, oldestIndex);
      return ((lastCumulativeVolatility - cumulativeVolatilityAtStart) / WINDOW); // sample is big enough to ignore bias of variance
    } else if (time != oldestTimestamp) {
      uint88 _oldestVolatilityCumulative = oldest.volatilityCumulative;
      uint32 unbiasedDenominator = time - oldestTimestamp;
      if (unbiasedDenominator > 1) unbiasedDenominator--; // Bessel's correction for "small" sample
      return ((lastCumulativeVolatility - _oldestVolatilityCumulative) / unbiasedDenominator);
    }
  }

  /// @notice Initialize the dataStorage array by writing the first slot. Called once for the lifecycle of the timepoints array
  /// @param self The stored dataStorage array
  /// @param time The time of the dataStorage initialization, via block.timestamp truncated to uint32
  /// @param tick Initial tick
  function initialize(Timepoint[UINT16_MODULO] storage self, uint32 time, int24 tick) internal {
    Timepoint storage _zero = self[0];
    require(!_zero.initialized);
    (_zero.initialized, _zero.blockTimestamp, _zero.averageTick) = (true, time, tick);
  }

  /// @notice Writes a dataStorage timepoint to the array
  /// @dev Writable at most once per block. Index represents the most recently written element. index must be tracked externally.
  /// @param self The stored dataStorage array
  /// @param lastIndex The index of the timepoint that was most recently written to the timepoints array
  /// @param blockTimestamp The timestamp of the new timepoint
  /// @param tick The active tick at the time of the new timepoint
  /// @param liquidity The total in-range liquidity at the time of the new timepoint
  /// @return indexUpdated The new index of the most recently written element in the dataStorage array
  function write(
    Timepoint[UINT16_MODULO] storage self,
    uint16 lastIndex,
    uint32 blockTimestamp,
    int24 tick,
    uint128 liquidity
  ) internal returns (uint16 indexUpdated, uint16 oldestIndex, uint88 volatilityCumulative) {
    Timepoint storage _last = self[lastIndex];
    // early return if we've already written a timepoint this block
    if (_last.blockTimestamp == blockTimestamp) return (lastIndex, 0, 0);

    Timepoint memory last = _last;

    // get next index considering overflow
    indexUpdated = lastIndex + 1;

    // check if we have overflow in the past
    if (self[indexUpdated].initialized) oldestIndex = indexUpdated;

    (int24 avgTick, int24 prevTick) = getAvgAndPrevTick(self, blockTimestamp, tick, lastIndex, oldestIndex, last.blockTimestamp, last.tickCumulative);

    self[indexUpdated] = createNewTimepoint(last, blockTimestamp, tick, prevTick, liquidity, avgTick);
    volatilityCumulative = self[indexUpdated].volatilityCumulative;
  }
}
