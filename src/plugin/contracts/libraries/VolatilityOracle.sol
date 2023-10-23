// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

/// @title VolatilityOracle
/// @notice Provides price and volatility data useful for a wide variety of system designs
/// @dev Instances of stored oracle data, "timepoints", are collected in the oracle array
/// Timepoints are overwritten when the full length of the timepoints array is populated.
/// The most recent timepoint is available by passing 0 to getSingleTimepoint().
/// Version for AlgebraBasePluginV1
library VolatilityOracle {
  /// @notice `target` timestamp is older than oldest timepoint
  error targetIsTooOld();

  /// @notice oracle is initialized already
  error volatilityOracleAlreadyInitialized();

  uint32 internal constant WINDOW = 1 days;
  uint256 private constant UINT16_MODULO = 65536;

  struct Timepoint {
    bool initialized; // whether or not the timepoint is initialized
    uint32 blockTimestamp; // the block timestamp of the timepoint
    int56 tickCumulative; // the tick accumulator, i.e. tick * time elapsed since the pool was first initialized
    uint88 volatilityCumulative; // the volatility accumulator; overflow after ~34800 years is desired :)
    int24 tick; // tick at this blockTimestamp
    int24 averageTick; // average tick at this blockTimestamp (for WINDOW seconds)
    uint16 windowStartIndex; // closest timepoint lte WINDOW seconds ago (or oldest timepoint), _should be used only from last timepoint_!
  }

  /// @notice Initialize the timepoints array by writing the first slot. Called once for the lifecycle of the timepoints array
  /// @param self The stored timepoints array
  /// @param time The time of the oracle initialization, via block.timestamp truncated to uint32
  /// @param tick Initial tick
  function initialize(Timepoint[UINT16_MODULO] storage self, uint32 time, int24 tick) internal {
    Timepoint storage _zero = self[0];
    if (_zero.initialized) revert volatilityOracleAlreadyInitialized();
    (_zero.initialized, _zero.blockTimestamp, _zero.tick, _zero.averageTick) = (true, time, tick, tick);
  }

  /// @notice Writes a timepoint to the array
  /// @dev Writable at most once per block. `lastIndex` must be tracked externally.
  /// @param self The stored timepoints array
  /// @param lastIndex The index of the timepoint that was most recently written to the timepoints array
  /// @param blockTimestamp The timestamp of the new timepoint
  /// @param tick The active tick at the time of the new timepoint
  /// @return indexUpdated The new index of the most recently written element in the timepoints array
  /// @return oldestIndex The new index of the oldest timepoint
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
    unchecked {
      // overflow of indexes is desired
      if (windowStartIndex == indexUpdated) windowStartIndex++; // important, since this value can be used to narrow the search
      self[indexUpdated] = _createNewTimepoint(last, blockTimestamp, tick, avgTick, windowStartIndex);
      if (oldestIndex == indexUpdated) oldestIndex++; // previous oldest index has been overwritten
    }
  }

  /// @dev Reverts if a timepoint at or before the desired timepoint timestamp does not exist.
  /// 0 may be passed as `secondsAgo' to return the current cumulative values.
  /// If called with a timestamp falling between two timepoints, returns the counterfactual accumulator values
  /// at exactly the timestamp between the two timepoints.
  /// @dev `volatilityCumulative` values for timestamps after the last timepoint _should not_ be compared because they may differ due to interpolation errors
  /// @param self The stored timepoints array
  /// @param time The current block timestamp
  /// @param secondsAgo The amount of time to look back, in seconds, at which point to return a timepoint
  /// @param tick The current tick
  /// @param lastIndex The index of the timepoint that was most recently written to the timepoints array
  /// @param oldestIndex The index of the oldest timepoint
  /// @return targetTimepoint desired timepoint or it's interpolation
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
          target,
          tick,
          lastIndex,
          oldestIndex,
          targetTimepoint.blockTimestamp,
          targetTimepoint.tickCumulative
        );
        return _createNewTimepoint(targetTimepoint, target, tick, avgTick, windowStartIndex);
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
  /// @dev `volatilityCumulative` values for timestamps after the last timepoint _should not_ be compared because they may differ due to interpolation errors
  /// @param self The stored timepoints array
  /// @param currentTime The current block.timestamp
  /// @param secondsAgos Each amount of time to look back, in seconds, at which point to return a timepoint
  /// @param tick The current tick
  /// @param lastIndex The index of the timepoint that was most recently written to the timepoints array
  /// @return tickCumulatives The cumulative time-weighted tick since the pool was first initialized, as of each `secondsAgo`
  /// @return volatilityCumulatives The cumulative volatility values since the pool was first initialized, as of each `secondsAgo`
  function getTimepoints(
    Timepoint[UINT16_MODULO] storage self,
    uint32 currentTime,
    uint32[] memory secondsAgos,
    int24 tick,
    uint16 lastIndex
  ) internal view returns (int56[] memory tickCumulatives, uint88[] memory volatilityCumulatives) {
    uint256 secondsLength = secondsAgos.length;
    tickCumulatives = new int56[](secondsLength);
    volatilityCumulatives = new uint88[](secondsLength);

    uint16 oldestIndex = getOldestIndex(self, lastIndex);
    Timepoint memory current;
    unchecked {
      for (uint256 i; i < secondsLength; ++i) {
        current = getSingleTimepoint(self, currentTime, secondsAgos[i], tick, lastIndex, oldestIndex);
        (tickCumulatives[i], volatilityCumulatives[i]) = (current.tickCumulative, current.volatilityCumulative);
      }
    }
  }

  /// @notice Returns the index of the oldest timepoint
  /// @param self The stored timepoints array
  /// @param lastIndex The index of the timepoint that was most recently written to the timepoints array
  /// @return oldestIndex The index of the oldest timepoint
  function getOldestIndex(Timepoint[UINT16_MODULO] storage self, uint16 lastIndex) internal view returns (uint16 oldestIndex) {
    unchecked {
      uint16 nextIndex = lastIndex + 1; // considering overflow
      if (self[nextIndex].initialized) oldestIndex = nextIndex; // check if we have overflow in the past
    }
  }

  /// @notice Returns average volatility in the range from currentTime-WINDOW to currentTime
  /// @param self The stored timepoints array
  /// @param currentTime The current block.timestamp
  /// @param tick The current tick
  /// @param lastIndex The index of the timepoint that was most recently written to the timepoints array
  /// @param oldestIndex The index of the oldest timepoint
  /// @return volatilityAverage The average volatility in the recent range
  function getAverageVolatility(
    Timepoint[UINT16_MODULO] storage self,
    uint32 currentTime,
    int24 tick,
    uint16 lastIndex,
    uint16 oldestIndex
  ) internal view returns (uint88 volatilityAverage) {
    unchecked {
      Timepoint storage lastTimepoint = self[lastIndex];
      bool timeAtLastTimepoint = lastTimepoint.blockTimestamp == currentTime;
      uint88 lastCumulativeVolatility = lastTimepoint.volatilityCumulative;
      uint16 windowStartIndex = lastTimepoint.windowStartIndex; // index of timepoint before of at lastTimepoint.blockTimestamp - WINDOW

      if (!timeAtLastTimepoint) {
        lastCumulativeVolatility = _getVolatilityCumulativeAt(self, currentTime, 0, tick, lastIndex, oldestIndex);
      }

      uint32 oldestTimestamp = self[oldestIndex].blockTimestamp;
      if (_lteConsideringOverflow(oldestTimestamp, currentTime - WINDOW, currentTime)) {
        // oldest timepoint is earlier than 24 hours ago
        uint88 cumulativeVolatilityAtStart;
        if (timeAtLastTimepoint) {
          // interpolate cumulative volatility to avoid search. Since the last timepoint has _just_ been written, we know for sure
          // that the start of the window is between windowStartIndex and windowStartIndex + 1
          (oldestTimestamp, cumulativeVolatilityAtStart) = (self[windowStartIndex].blockTimestamp, self[windowStartIndex].volatilityCumulative);

          uint32 timeDeltaBetweenPoints = self[windowStartIndex + 1].blockTimestamp - oldestTimestamp;

          cumulativeVolatilityAtStart +=
            ((self[windowStartIndex + 1].volatilityCumulative - cumulativeVolatilityAtStart) * (currentTime - WINDOW - oldestTimestamp)) /
            timeDeltaBetweenPoints;
        } else {
          cumulativeVolatilityAtStart = _getVolatilityCumulativeAt(self, currentTime, WINDOW, tick, lastIndex, oldestIndex);
        }

        return ((lastCumulativeVolatility - cumulativeVolatilityAtStart) / WINDOW); // sample is big enough to ignore bias of variance
      } else if (currentTime != oldestTimestamp) {
        // recorded timepoints are not enough, so we will extrapolate
        uint88 _oldestVolatilityCumulative = self[oldestIndex].volatilityCumulative;
        uint32 unbiasedDenominator = currentTime - oldestTimestamp;
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
  ) internal pure returns (Timepoint memory) {
    unchecked {
      uint32 delta = blockTimestamp - last.blockTimestamp; // overflow is desired
      // We don't create a new structure in memory to save gas. Therefore, the function changes the old structure
      last.initialized = true;
      last.blockTimestamp = blockTimestamp;
      last.tickCumulative += int56(tick) * int56(uint56(delta));
      last.volatilityCumulative += uint88(_volatilityOnRange(int256(uint256(delta)), tick, tick, last.averageTick, averageTick)); // always fits 88 bits
      last.tick = tick;
      last.averageTick = averageTick;
      last.windowStartIndex = windowStartIndex;
      return last;
    }
  }

  /// @notice Calculates volatility between two sequential timepoints with resampling to 1 sec frequency
  /// @param dt Timedelta between timepoints, must be within uint32 range
  /// @param tick0 The tick after the left timepoint, must be within int24 range
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
      int256 k = (tick1 - tick0) - (avgTick1 - avgTick0); // (k - p)*dt
      int256 b = (tick0 - avgTick0) * dt; // (b - q)*dt
      int256 sumOfSequence = dt * (dt + 1); // sumOfSequence * 2
      int256 sumOfSquares = sumOfSequence * (2 * dt + 1); // sumOfSquares * 6
      volatility = uint256((k ** 2 * sumOfSquares + 6 * b * k * sumOfSequence + 6 * dt * b ** 2) / (6 * dt ** 2));
    }
  }

  /// @notice Calculates average tick for WINDOW seconds at the moment of `time`
  /// @dev Guaranteed that the result is within the bounds of int24
  /// @return avgTick The average tick
  /// @return windowStartIndex The index of closest timepoint <= WINDOW seconds ago
  function _getAverageTickCasted(
    Timepoint[UINT16_MODULO] storage self,
    uint32 time,
    int24 tick,
    uint16 lastIndex,
    uint16 oldestIndex,
    uint32 lastTimestamp,
    int56 lastTickCumulative
  ) internal view returns (int24 avgTick, uint16 windowStartIndex) {
    (int256 _avgTick, uint256 _windowStartIndex) = _getAverageTick(self, time, tick, lastIndex, oldestIndex, lastTimestamp, lastTickCumulative);
    unchecked {
      (avgTick, windowStartIndex) = (int24(_avgTick), uint16(_windowStartIndex)); // overflow in uint16(_windowStartIndex) is desired
    }
  }

  /// @notice Calculates average tick for WINDOW seconds at the moment of `currentTime`
  /// @dev Guaranteed that the result is within the bounds of int24, but result is not casted
  /// @return avgTick int256 for fuzzy tests
  /// @return windowStartIndex The index of closest timepoint <= WINDOW seconds ago
  function _getAverageTick(
    Timepoint[UINT16_MODULO] storage self,
    uint32 currentTime,
    int24 tick,
    uint16 lastIndex,
    uint16 oldestIndex,
    uint32 lastTimestamp,
    int56 lastTickCumulative
  ) internal view returns (int256 avgTick, uint256 windowStartIndex) {
    (uint32 oldestTimestamp, int56 oldestTickCumulative) = (self[oldestIndex].blockTimestamp, self[oldestIndex].tickCumulative);

    unchecked {
      int56 currentTickCumulative = lastTickCumulative + int56(tick) * int56(uint56(currentTime - lastTimestamp)); // update with new data
      if (!_lteConsideringOverflow(oldestTimestamp, currentTime - WINDOW, currentTime)) {
        // if oldest is newer than WINDOW ago
        if (currentTime == oldestTimestamp) return (tick, oldestIndex);
        return ((currentTickCumulative - oldestTickCumulative) / int56(uint56(currentTime - oldestTimestamp)), oldestIndex);
      }

      if (_lteConsideringOverflow(lastTimestamp, currentTime - WINDOW, currentTime)) {
        // if last timepoint is older or equal than WINDOW ago
        return (tick, lastIndex);
      } else {
        int56 tickCumulativeAtStart;
        (tickCumulativeAtStart, windowStartIndex) = _getTickCumulativeAt(self, currentTime, WINDOW, tick, lastIndex, oldestIndex);

        //    current-WINDOW  last   current
        // _________*____________*_______*_
        //          ||||||||||||||||||||||
        avgTick = (currentTickCumulative - tickCumulativeAtStart) / int56(uint56(WINDOW));
      }
    }
  }

  /// @notice comparator for 32-bit timestamps
  /// @dev safe for 0 or 1 overflows, a and b _must_ be chronologically before or equal to currentTime
  /// @param a A comparison timestamp from which to determine the relative position of `currentTime`
  /// @param b From which to determine the relative position of `currentTime`
  /// @param currentTime A timestamp truncated to 32 bits
  /// @return res Whether `a` is chronologically <= `b`
  function _lteConsideringOverflow(uint32 a, uint32 b, uint32 currentTime) internal pure returns (bool res) {
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
      (Timepoint storage beforeOrAt, Timepoint storage atOrAfter, bool samePoint, ) = _getTimepointsAt(self, time, target, lastIndex, oldestIndex);

      (uint32 timestampBefore, uint88 volatilityCumulativeBefore) = (beforeOrAt.blockTimestamp, beforeOrAt.volatilityCumulative);
      if (target == timestampBefore) return volatilityCumulativeBefore; // we're at the left boundary
      if (samePoint) {
        // since target != beforeOrAt.blockTimestamp, `samePoint` means that target is newer than last timepoint
        (int24 avgTick, ) = _getAverageTickCasted(self, target, tick, lastIndex, oldestIndex, timestampBefore, beforeOrAt.tickCumulative);

        return (volatilityCumulativeBefore +
          uint88(_volatilityOnRange(int256(uint256(target - timestampBefore)), tick, tick, beforeOrAt.averageTick, avgTick)));
      }

      (uint32 timestampAfter, uint88 volatilityCumulativeAfter) = (atOrAfter.blockTimestamp, atOrAfter.volatilityCumulative);
      if (target == timestampAfter) return volatilityCumulativeAfter; // we're at the right boundary

      // we're in the middle
      (uint32 timepointTimeDelta, uint32 targetDelta) = (timestampAfter - timestampBefore, target - timestampBefore);
      return volatilityCumulativeBefore + ((volatilityCumulativeAfter - volatilityCumulativeBefore) / timepointTimeDelta) * targetDelta;
    }
  }

  /// @notice Calculates cumulative tick at the moment of `time` - `secondsAgo`
  /// @dev More optimal than via `getSingleTimepoint`
  /// @return tickCumulative The cumulative tick
  /// @return indexBeforeOrAt The index of closest timepoint before or at the moment of `time` - `secondsAgo`
  function _getTickCumulativeAt(
    Timepoint[UINT16_MODULO] storage self,
    uint32 time,
    uint32 secondsAgo,
    int24 tick,
    uint16 lastIndex,
    uint16 oldestIndex
  ) internal view returns (int56 tickCumulative, uint256 indexBeforeOrAt) {
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
      if (target == timestampAfter) return (tickCumulativeAfter, uint16(_indexBeforeOrAt + 1)); // we're at the right boundary

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
  /// @return indexBeforeOrAt The index of closest timepoint before or at the moment of `target`
  function _getTimepointsAt(
    Timepoint[UINT16_MODULO] storage self,
    uint32 currentTime,
    uint32 target,
    uint16 lastIndex,
    uint16 oldestIndex
  ) private view returns (Timepoint storage beforeOrAt, Timepoint storage atOrAfter, bool samePoint, uint256 indexBeforeOrAt) {
    Timepoint storage lastTimepoint = self[lastIndex];
    uint32 lastTimepointTimestamp = lastTimepoint.blockTimestamp;
    uint16 windowStartIndex = lastTimepoint.windowStartIndex;

    // if target is newer than last timepoint
    if (target == currentTime || _lteConsideringOverflow(lastTimepointTimestamp, target, currentTime)) {
      return (lastTimepoint, lastTimepoint, true, lastIndex);
    }

    bool useHeuristic;
    unchecked {
      if (lastTimepointTimestamp - target <= WINDOW) {
        // We can limit the scope of the search. It is safe because when the array overflows,
        // `windowsStartIndex` cannot point to the overwritten timepoint (check at `write(...)`)
        oldestIndex = windowStartIndex;
        useHeuristic = target == currentTime - WINDOW; // heuristic will optimize search for timepoints close to `currentTime - WINDOW`
      }
      uint32 oldestTimestamp = self[oldestIndex].blockTimestamp;

      if (!_lteConsideringOverflow(oldestTimestamp, target, currentTime)) revert targetIsTooOld();
      if (oldestTimestamp == target) return (self[oldestIndex], self[oldestIndex], true, oldestIndex);

      // no need to search if we already know the answer
      if (lastIndex == oldestIndex + 1) return (self[oldestIndex], lastTimepoint, false, oldestIndex);
    }

    (beforeOrAt, atOrAfter, indexBeforeOrAt) = _binarySearch(self, currentTime, target, lastIndex, oldestIndex, useHeuristic);
    return (beforeOrAt, atOrAfter, false, indexBeforeOrAt);
  }

  /// @notice Fetches the timepoints beforeOrAt and atOrAfter a target, i.e. where [beforeOrAt, atOrAfter] is satisfied.
  /// The result may be the same timepoint, or adjacent timepoints.
  /// @dev The answer must be older than the most recent timepoint and younger, or the same age as, the oldest timepoint
  /// @param self The stored timepoints array
  /// @param currentTime The current block.timestamp
  /// @param target The timestamp at which the timepoint should be
  /// @param upperIndex The index of the upper border of search range
  /// @param lowerIndex The index of the lower border of search range
  /// @param withHeuristic Use heuristic for first guess or not (optimize for targets close to `lowerIndex`)
  /// @return beforeOrAt The timepoint recorded before, or at, the target
  /// @return atOrAfter The timepoint recorded at, or after, the target
  function _binarySearch(
    Timepoint[UINT16_MODULO] storage self,
    uint32 currentTime,
    uint32 target,
    uint16 upperIndex,
    uint16 lowerIndex,
    bool withHeuristic
  ) private view returns (Timepoint storage beforeOrAt, Timepoint storage atOrAfter, uint256 indexBeforeOrAt) {
    unchecked {
      uint256 left = lowerIndex; // oldest timepoint
      uint256 right = upperIndex < lowerIndex ? upperIndex + UINT16_MODULO : upperIndex; // newest timepoint considering one index overflow
      (beforeOrAt, atOrAfter, indexBeforeOrAt) = _binarySearchInternal(self, currentTime, target, left, right, withHeuristic);
    }
  }

  function _binarySearchInternal(
    Timepoint[UINT16_MODULO] storage self,
    uint32 currentTime,
    uint32 target,
    uint256 left,
    uint256 right,
    bool withHeuristic
  ) private view returns (Timepoint storage beforeOrAt, Timepoint storage atOrAfter, uint256 indexBeforeOrAt) {
    unchecked {
      if (withHeuristic && right - left > 2) {
        indexBeforeOrAt = left + 1; // heuristic for first guess
      } else {
        indexBeforeOrAt = (left + right) >> 1; // "middle" point between the boundaries
      }
      beforeOrAt = self[uint16(indexBeforeOrAt)]; // checking the "middle" point between the boundaries
      atOrAfter = beforeOrAt; // to suppress compiler warning; will be overridden
      bool firstIteration = true;
      do {
        (bool initializedBefore, uint32 timestampBefore) = (beforeOrAt.initialized, beforeOrAt.blockTimestamp);
        if (initializedBefore) {
          if (_lteConsideringOverflow(timestampBefore, target, currentTime)) {
            // is current point before or at `target`?
            atOrAfter = self[uint16(indexBeforeOrAt + 1)]; // checking the next point after "middle"
            (bool initializedAfter, uint32 timestampAfter) = (atOrAfter.initialized, atOrAfter.blockTimestamp);
            if (initializedAfter) {
              if (_lteConsideringOverflow(target, timestampAfter, currentTime)) {
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
        // use heuristic if looking in the right half after first iteration
        bool useHeuristic = firstIteration && withHeuristic && left == indexBeforeOrAt + 1;
        if (useHeuristic && right - left > 16) {
          indexBeforeOrAt = left + 8;
        } else {
          indexBeforeOrAt = (left + right) >> 1; // calculating the new "middle" point index after updating the bounds
        }
        beforeOrAt = self[uint16(indexBeforeOrAt)]; // update the "middle" point pointer
        firstIteration = false;
      } while (true);
    }
  }
}
