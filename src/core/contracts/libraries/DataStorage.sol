// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

/// @title DataStorage
/// @notice Provides price, liquidity, volatility data useful for a wide variety of system designs
/// @dev Instances of stored dataStorage data, "timepoints", are collected in the dataStorage array
/// Timepoints are overwritten when the full length of the dataStorage array is populated.
/// The most recent timepoint is available by passing 0 to getSingleTimepoint()
library DataStorage {
  /// @notice `target` timestamp is older than oldest timepoint
  error targetIsTooOld();

  uint32 internal constant WINDOW = 1 days;
  uint256 private constant UINT16_MODULO = 65536;

  struct Timepoint {
    bool initialized; // whether or not the timepoint is initialized
    uint32 blockTimestamp; // the block timestamp of the timepoint
    int56 tickCumulative; // the tick accumulator, i.e. tick * time elapsed since the pool was first initialized
    uint88 volatilityCumulative; // the volatility accumulator; overflow after ~34800 years is desired :)
    int24 tick; // tick at this blockTimestamp
    int24 averageTick; // average tick at this blockTimestamp (for WINDOW seconds)
    uint16 windowStartIndex; // index of closest timepoint >= WINDOW seconds ago, used to speed up searches
  }

  /// @notice Initialize the dataStorage array by writing the first slot. Called once for the lifecycle of the timepoints array
  /// @param self The stored dataStorage array
  /// @param time The time of the dataStorage initialization, via block.timestamp truncated to uint32
  /// @param tick Initial tick
  function initialize(Timepoint[UINT16_MODULO] storage self, uint32 time, int24 tick) internal {
    Timepoint storage _zero = self[0];
    require(!_zero.initialized);
    (_zero.initialized, _zero.blockTimestamp, _zero.tick, _zero.averageTick) = (true, time, tick, tick);
  }

  /// @notice Writes a dataStorage timepoint to the array
  /// @dev Writable at most once per block. Index represents the most recently written element. index must be tracked externally.
  /// @param self The stored dataStorage array
  /// @param lastIndex The index of the timepoint that was most recently written to the timepoints array
  /// @param blockTimestamp The timestamp of the new timepoint
  /// @param tick The active tick at the time of the new timepoint
  /// @return indexUpdated The new index of the most recently written element in the dataStorage array
  /// @return oldestIndex The index of the oldest timepoint
  function write(
    Timepoint[UINT16_MODULO] storage self,
    uint16 lastIndex,
    uint32 blockTimestamp,
    int24 tick
  ) internal returns (uint16 indexUpdated, uint16 oldestIndex) {
    Timepoint memory last = self[lastIndex];
    // early return if we've already written a timepoint this block
    if (last.blockTimestamp == blockTimestamp) return (lastIndex, 0);

    // get next index considering overflow
    unchecked {
      indexUpdated = lastIndex + 1;
    }

    // check if we have overflow in the past
    if (self[indexUpdated].initialized) oldestIndex = indexUpdated;

    (int24 avgTick, uint16 windowStartIndex) = _getAverageTickCasted(
      self,
      blockTimestamp,
      tick,
      lastIndex,
      oldestIndex,
      last.blockTimestamp,
      last.tickCumulative
    );
    self[indexUpdated] = _createNewTimepoint(last, blockTimestamp, tick, avgTick, windowStartIndex);
    if (oldestIndex == indexUpdated) oldestIndex++; // previous oldest index has been overwritten
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
  /// @return targetTimepoint desired timepoint or it's approximation
  function getSingleTimepoint(
    Timepoint[UINT16_MODULO] storage self,
    uint32 time,
    uint32 secondsAgo,
    int24 tick,
    uint16 lastIndex,
    uint16 oldestIndex
  ) internal view returns (Timepoint memory targetTimepoint) {
    unchecked {
      uint32 target = time - secondsAgo;
      (Timepoint storage beforeOrAt, Timepoint storage atOrAfter, bool samePoint, ) = _getTimepointsAt(self, time, target, lastIndex, oldestIndex);

      targetTimepoint = beforeOrAt;
      if (target == targetTimepoint.blockTimestamp) return targetTimepoint; // we're at the left boundary
      if (samePoint) {
        // if target is newer than last timepoint
        (int24 avgTick, uint16 windowStartIndex) = _getAverageTickCasted(
          self,
          time,
          tick,
          lastIndex,
          oldestIndex,
          targetTimepoint.blockTimestamp,
          targetTimepoint.tickCumulative
        );
        return _createNewTimepoint(targetTimepoint, time - secondsAgo, tick, avgTick, windowStartIndex);
      }

      (uint32 timestampAfter, int56 tickCumulativeAfter) = (atOrAfter.blockTimestamp, atOrAfter.tickCumulative);
      if (target == timestampAfter) return atOrAfter; // we're at the right boundary

      // we're in the middle
      (uint32 timepointTimeDelta, uint32 targetDelta) = (timestampAfter - targetTimepoint.blockTimestamp, target - targetTimepoint.blockTimestamp);

      targetTimepoint.tickCumulative +=
        ((tickCumulativeAfter - targetTimepoint.tickCumulative) / int56(uint56(timepointTimeDelta))) *
        int56(uint56(targetDelta));
      targetTimepoint.volatilityCumulative +=
        ((atOrAfter.volatilityCumulative - targetTimepoint.volatilityCumulative) / timepointTimeDelta) *
        targetDelta;
    }
  }

  /// @notice Returns the accumulator values as of each time seconds ago from the given time in the array of `secondsAgos`
  /// @dev Reverts if `secondsAgos` > oldest timepoint
  /// @param self The stored dataStorage array
  /// @param time The current block.timestamp
  /// @param secondsAgos Each amount of time to look back, in seconds, at which point to return a timepoint
  /// @param tick The current tick
  /// @param lastIndex The index of the timepoint that was most recently written to the timepoints array
  /// @return tickCumulatives The tick * time elapsed since the pool was first initialized, as of each `secondsAgo`
  /// @return volatilityCumulatives The cumulative volatility values since the pool was first initialized, as of each `secondsAgo`
  function getTimepoints(
    Timepoint[UINT16_MODULO] storage self,
    uint32 time,
    uint32[] memory secondsAgos,
    int24 tick,
    uint16 lastIndex
  ) internal view returns (int56[] memory tickCumulatives, uint112[] memory volatilityCumulatives) {
    uint256 secondsLength = secondsAgos.length;
    tickCumulatives = new int56[](secondsLength);
    volatilityCumulatives = new uint112[](secondsLength);

    uint16 oldestIndex = getOldestIndex(self, lastIndex);
    Timepoint memory current;
    unchecked {
      for (uint256 i; i < secondsLength; ++i) {
        current = getSingleTimepoint(self, time, secondsAgos[i], tick, lastIndex, oldestIndex);
        (tickCumulatives[i], volatilityCumulatives[i]) = (current.tickCumulative, current.volatilityCumulative);
      }
    }
  }

  /// @notice Returns the index of the oldest timepoint
  /// @param self The stored dataStorage array
  /// @param lastIndex The index of the timepoint that was most recently written to the timepoints array
  /// @return oldestIndex The index of the oldest timepoint
  function getOldestIndex(Timepoint[UINT16_MODULO] storage self, uint16 lastIndex) internal view returns (uint16 oldestIndex) {
    unchecked {
      uint16 nextIndex = lastIndex + 1; // considering overflow
      if (self[nextIndex].initialized) oldestIndex = nextIndex; // check if we have overflow in the past
    }
  }

  /// @notice Returns average volatility in the range from time-WINDOW to time
  /// @param self The stored dataStorage array
  /// @param time The current block.timestamp
  /// @param tick The current tick
  /// @param lastIndex The index of the timepoint that was most recently written to the timepoints array
  /// @param oldestIndex The index of the oldest timepoint
  /// @return volatilityAverage The average volatility in the recent range
  function getAverageVolatility(
    Timepoint[UINT16_MODULO] storage self,
    uint32 time,
    int24 tick,
    uint16 lastIndex,
    uint16 oldestIndex,
    uint88 lastCumulativeVolatility
  ) internal view returns (uint88 volatilityAverage) {
    unchecked {
      uint32 oldestTimestamp = self[oldestIndex].blockTimestamp;

      if (_lteConsideringOverflow(oldestTimestamp, time - WINDOW, time)) {
        if (self[lastIndex].blockTimestamp == time) {
          // we can simplify the search, because when the timepoint was created, the search was already done
          oldestIndex = self[lastIndex].windowStartIndex;
          oldestTimestamp = self[oldestIndex].blockTimestamp;
          if (lastIndex != oldestIndex) lastIndex = oldestIndex + 1;
        }

        uint88 cumulativeVolatilityAtStart = _getVolatilityCumulativeAt(self, time, WINDOW, tick, lastIndex, oldestIndex);
        return ((lastCumulativeVolatility - cumulativeVolatilityAtStart) / WINDOW); // sample is big enough to ignore bias of variance
      } else if (time != oldestTimestamp) {
        // recorded timepoints are not enough, so we will extrapolate
        uint88 _oldestVolatilityCumulative = self[oldestIndex].volatilityCumulative;
        uint32 unbiasedDenominator = time - oldestTimestamp;
        if (unbiasedDenominator > 1) unbiasedDenominator--; // Bessel's correction for "small" sample
        return ((lastCumulativeVolatility - _oldestVolatilityCumulative) / unbiasedDenominator);
      }
    }
  }

  // ##### further functions are private to the library, but some are made internal for fuzzy testing #####

  /// @notice Transforms a previous timepoint into a new timepoint, given the passage of time and the current tick and liquidity values
  /// @dev blockTimestamp _must_ be chronologically equal to or greater than last.blockTimestamp, safe for 0 or 1 overflows
  /// @dev The function changes the structure given to the input, and does not create a new one
  /// @param last The specified timepoint to be used in creation of new timepoint
  /// @param blockTimestamp The timestamp of the new timepoint
  /// @param tick The active tick at the time of the new timepoint
  /// @param averageTick The average tick at the time of the new timepoint
  /// @param windowStartIndex The index of closest timepoint >= WINDOW seconds ago
  /// @return Timepoint The newly populated timepoint
  function _createNewTimepoint(
    Timepoint memory last,
    uint32 blockTimestamp,
    int24 tick,
    int24 averageTick,
    uint16 windowStartIndex
  ) private pure returns (Timepoint memory) {
    unchecked {
      uint32 delta = blockTimestamp - last.blockTimestamp; // overflow is desired
      // We don't create a new structure in memory to save gas. Therefore, the function changes the old structure
      last.initialized = true;
      last.blockTimestamp = blockTimestamp;
      last.tickCumulative += int56(tick) * int56(uint56(delta));
      last.volatilityCumulative += uint88(_volatilityOnRange(int256(uint256(delta)), last.tick, tick, last.averageTick, averageTick)); // always fits 88 bits
      last.tick = tick;
      last.averageTick = averageTick;
      last.windowStartIndex = windowStartIndex;
      return last;
    }
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
    unchecked {
      int256 K = (tick1 - tick0) - (avgTick1 - avgTick0); // (k - p)*dt
      int256 B = (tick0 - avgTick0) * dt; // (b - q)*dt
      int256 sumOfSequence = dt * (dt + 1); // sumOfSequence * 2
      int256 sumOfSquares = sumOfSequence * (2 * dt + 1); // sumOfSquares * 6
      volatility = uint256((K ** 2 * sumOfSquares + 6 * B * K * sumOfSequence + 6 * dt * B ** 2) / (6 * dt ** 2));
    }
  }

  /// @notice Calculates average tick for WINDOW seconds at the moment of `time`
  /// @dev Guaranteed that the result is within the bounds of int24
  /// @return avgTick int256 for fuzzy tests
  /// @return windowStartIndex The index of closest timepoint <= WINDOW seconds ago
  function _getAverageTickCasted(
    Timepoint[UINT16_MODULO] storage self,
    uint32 time,
    int24 tick,
    uint16 lastIndex,
    uint16 oldestIndex,
    uint32 lastTimestamp,
    int56 lastTickCumulative
  ) private view returns (int24 avgTick, uint16 windowStartIndex) {
    (int256 _avgTick, uint256 _windowStartIndex) = _getAverageTick(self, time, tick, lastIndex, oldestIndex, lastTimestamp, lastTickCumulative);
    unchecked {
      (avgTick, windowStartIndex) = (int24(_avgTick), uint16(_windowStartIndex)); // overflow in uint16(_windowStartIndex) is desired
    }
  }

  /// @notice Calculates average tick for WINDOW seconds at the moment of `time`
  /// @dev Guaranteed that the result is within the bounds of int24, but result is not casted
  /// @return avgTick int256 for fuzzy tests
  /// @return windowStartIndex The index of closest timepoint <= WINDOW seconds ago
  function _getAverageTick(
    Timepoint[UINT16_MODULO] storage self,
    uint32 time,
    int24 tick,
    uint16 lastIndex,
    uint16 oldestIndex,
    uint32 lastTimestamp,
    int56 lastTickCumulative
  ) internal view returns (int256 avgTick, uint256 windowStartIndex) {
    (uint32 oldestTimestamp, int56 oldestTickCumulative) = (self[oldestIndex].blockTimestamp, self[oldestIndex].tickCumulative);
    unchecked {
      if (!_lteConsideringOverflow(oldestTimestamp, time - WINDOW, time)) {
        // if oldest is newer than WINDOW ago
        return (
          (lastTimestamp == oldestTimestamp) ? tick : (lastTickCumulative - oldestTickCumulative) / int56(uint56(lastTimestamp - oldestTimestamp)),
          oldestIndex
        );
      }

      if (_lteConsideringOverflow(lastTimestamp, time - WINDOW, time)) {
        Timepoint storage _start = self[lastIndex - 1]; // considering underflow
        (bool initialized, uint32 startTimestamp, int56 startTickCumulative) = (_start.initialized, _start.blockTimestamp, _start.tickCumulative);
        avgTick = initialized ? (lastTickCumulative - startTickCumulative) / int56(uint56(lastTimestamp - startTimestamp)) : tick;
        windowStartIndex = lastIndex;
      } else {
        if (time == lastTimestamp) {
          oldestIndex = self[lastIndex].windowStartIndex;
          lastIndex = oldestIndex + 1;
        }
        int56 tickCumulativeAtStart;
        (tickCumulativeAtStart, windowStartIndex) = _getTickCumulativeAt(self, time, WINDOW, tick, lastIndex, oldestIndex);

        //    current-WINDOW  last   current
        // _________*____________*_______*_
        //           ||||||||||||
        avgTick = (lastTickCumulative - tickCumulativeAtStart) / int56(uint56(lastTimestamp - time + WINDOW));
      }
    }
  }

  /// @notice comparator for 32-bit timestamps
  /// @dev safe for 0 or 1 overflows, a and b _must_ be chronologically before or equal to currentTime
  /// @param a A comparison timestamp from which to determine the relative position of `currentTime`
  /// @param b From which to determine the relative position of `currentTime`
  /// @param currentTime A timestamp truncated to 32 bits
  /// @return res Whether `a` is chronologically <= `b`
  function _lteConsideringOverflow(uint32 a, uint32 b, uint32 currentTime) private pure returns (bool res) {
    res = a > currentTime;
    if (res == b > currentTime) res = a <= b; // if both are on the same side
  }

  /// @notice Calculates cumulative volatility at the moment of `time` - `secondsAgo`
  /// @dev More optimal than via `getSingleTimepoint`
  /// @return volatilityCumulative The cumulative volatility
  function _getVolatilityCumulativeAt(
    Timepoint[UINT16_MODULO] storage self,
    uint32 time,
    uint32 secondsAgo,
    int24 tick,
    uint16 lastIndex,
    uint16 oldestIndex
  ) internal view returns (uint88 volatilityCumulative) {
    unchecked {
      uint32 target = time - secondsAgo;
      (Timepoint memory beforeOrAt, Timepoint storage atOrAfter, bool samePoint, ) = _getTimepointsAt(self, time, target, lastIndex, oldestIndex);

      if (target == beforeOrAt.blockTimestamp) return beforeOrAt.volatilityCumulative; // we're at the left boundary
      if (samePoint) {
        // since target != beforeOrAt.blockTimestamp, `samePoint` means that target is newer than last timepoint
        (int24 avgTick, ) = _getAverageTickCasted(self, time, tick, lastIndex, oldestIndex, beforeOrAt.blockTimestamp, beforeOrAt.tickCumulative);
        return (beforeOrAt.volatilityCumulative +
          uint88(_volatilityOnRange(int256(uint256(target - beforeOrAt.blockTimestamp)), beforeOrAt.tick, tick, beforeOrAt.averageTick, avgTick)));
      }

      (uint32 timestampAfter, uint88 volatilityCumulativeAfter) = (atOrAfter.blockTimestamp, atOrAfter.volatilityCumulative);
      if (target == timestampAfter) return volatilityCumulativeAfter; // we're at the right boundary

      // we're in the middle
      (uint32 timepointTimeDelta, uint32 targetDelta) = (timestampAfter - beforeOrAt.blockTimestamp, target - beforeOrAt.blockTimestamp);

      return beforeOrAt.volatilityCumulative + ((volatilityCumulativeAfter - beforeOrAt.volatilityCumulative) / timepointTimeDelta) * targetDelta;
    }
  }

  /// @notice Calculates cumulative tick at the moment of `time` - `secondsAgo`
  /// @dev More optimal than via `getSingleTimepoint`
  /// @return tickCumulative The cumulative tick
  /// @return indexBeforeOrAt The index of closest timepoint before ot at the moment of `time` - `secondsAgo`
  function _getTickCumulativeAt(
    Timepoint[UINT16_MODULO] storage self,
    uint32 time,
    uint32 secondsAgo,
    int24 tick,
    uint16 lastIndex,
    uint16 oldestIndex
  ) private view returns (int56 tickCumulative, uint256 indexBeforeOrAt) {
    unchecked {
      uint32 target = time - secondsAgo;
      (Timepoint storage beforeOrAt, Timepoint storage atOrAfter, bool samePoint, uint256 _indexBeforeOrAt) = _getTimepointsAt(
        self,
        time,
        target,
        lastIndex,
        oldestIndex
      );

      (uint32 timestampBefore, int56 tickCumulativeBefore) = (beforeOrAt.blockTimestamp, beforeOrAt.tickCumulative);
      if (target == timestampBefore) return (tickCumulativeBefore, _indexBeforeOrAt); // we're at the left boundary
      // since target != timestampBefore, `samePoint` means that target is newer than last timepoint
      if (samePoint) return ((tickCumulativeBefore + int56(tick) * int56(uint56(target - timestampBefore))), _indexBeforeOrAt); // if target is newer than last timepoint

      (uint32 timestampAfter, int56 tickCumulativeAfter) = (atOrAfter.blockTimestamp, atOrAfter.tickCumulative);
      if (target == timestampAfter) return (tickCumulativeAfter, _indexBeforeOrAt); // we're at the right boundary

      // we're in the middle
      (uint32 timepointTimeDelta, uint32 targetDelta) = (timestampAfter - timestampBefore, target - timestampBefore);
      return (
        tickCumulativeBefore + ((tickCumulativeAfter - tickCumulativeBefore) / int56(uint56(timepointTimeDelta))) * int56(uint56(targetDelta)),
        _indexBeforeOrAt
      );
    }
  }

  /// @notice Returns closest timepoint or timepoints to the moment of `target`
  /// @return beforeOrAt The timepoint recorded before, or at, the target
  /// @return atOrAfter The timepoint recorded at, or after, the target
  /// @return samePoint Are `beforeOrAt` and `atOrAfter` the same or not
  /// @return indexBeforeOrAt The index of closest timepoint before ot at the moment of `target`
  function _getTimepointsAt(
    Timepoint[UINT16_MODULO] storage self,
    uint32 time,
    uint32 target,
    uint16 lastIndex,
    uint16 oldestIndex
  ) private view returns (Timepoint storage beforeOrAt, Timepoint storage atOrAfter, bool samePoint, uint256 indexBeforeOrAt) {
    // if target is newer than last timepoint
    if (target == time || _lteConsideringOverflow(self[lastIndex].blockTimestamp, target, time)) {
      return (self[lastIndex], self[lastIndex], true, lastIndex);
    }

    uint32 oldestTimestamp = self[oldestIndex].blockTimestamp;
    if (!_lteConsideringOverflow(oldestTimestamp, target, time)) revert targetIsTooOld();

    if (oldestTimestamp == target) return (self[oldestIndex], self[oldestIndex], true, oldestIndex);

    unchecked {
      if (time - target <= WINDOW) {
        // we can limit the scope of the search
        uint16 windowStartIndex = self[lastIndex].windowStartIndex;
        if (windowStartIndex != oldestIndex) {
          uint32 windowStartTimestamp = self[windowStartIndex].blockTimestamp;
          if (_lteConsideringOverflow(oldestTimestamp, windowStartTimestamp, time)) {
            (oldestIndex, oldestTimestamp) = (windowStartIndex, windowStartTimestamp);
            if (oldestTimestamp == target) return (self[oldestIndex], self[oldestIndex], true, oldestIndex);
          }
        }
      }
      // no need to search if we already know the answer
      if (lastIndex == oldestIndex + 1) return (self[oldestIndex], self[lastIndex], false, oldestIndex);
    }

    (beforeOrAt, atOrAfter, indexBeforeOrAt) = _binarySearch(self, time, target, lastIndex, oldestIndex);
    return (beforeOrAt, atOrAfter, false, indexBeforeOrAt);
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
  function _binarySearch(
    Timepoint[UINT16_MODULO] storage self,
    uint32 time,
    uint32 target,
    uint16 lastIndex,
    uint16 oldestIndex
  ) private view returns (Timepoint storage beforeOrAt, Timepoint storage atOrAfter, uint256 indexBeforeOrAt) {
    unchecked {
      uint256 left = oldestIndex; // oldest timepoint
      uint256 right = lastIndex < oldestIndex ? lastIndex + UINT16_MODULO : lastIndex; // newest timepoint considering one index overflow
      indexBeforeOrAt = (left + right) >> 1; // "middle" point between the boundaries

      do {
        beforeOrAt = self[uint16(indexBeforeOrAt)]; // checking the "middle" point between the boundaries
        (bool initializedBefore, uint32 timestampBefore) = (beforeOrAt.initialized, beforeOrAt.blockTimestamp);
        if (initializedBefore) {
          if (_lteConsideringOverflow(timestampBefore, target, time)) {
            // is current point before or at `target`?
            atOrAfter = self[uint16(indexBeforeOrAt + 1)]; // checking the next point after "middle"
            (bool initializedAfter, uint32 timestampAfter) = (atOrAfter.initialized, atOrAfter.blockTimestamp);
            if (initializedAfter) {
              if (_lteConsideringOverflow(target, timestampAfter, time)) {
                // is the "next" point after or at `target`?
                return (beforeOrAt, atOrAfter, indexBeforeOrAt); // the only fully correct way to finish
              }
              left = indexBeforeOrAt + 1; // "next" point is before the `target`, so looking in the right half
            } else {
              // beforeOrAt is initialized and <= target, and next timepoint is uninitialized
              // should be impossible if initial boundaries and `target` are correct
              return (beforeOrAt, beforeOrAt, indexBeforeOrAt);
            }
          } else {
            right = indexBeforeOrAt - 1; // current point is after the `target`, so looking in the left half
          }
        } else {
          // we've landed on an uninitialized timepoint, keep searching higher
          // should be impossible if initial boundaries and `target` are correct
          left = indexBeforeOrAt + 1;
        }
        indexBeforeOrAt = (left + right) >> 1; // calculating the new "middle" point index after updating the bounds
      } while (true);

      atOrAfter = beforeOrAt; // code is unreachable, to suppress compiler warning
      assert(false); // code is unreachable, used for fuzzy testing
    }
  }
}
