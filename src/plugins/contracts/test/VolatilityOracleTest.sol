// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../libraries/VolatilityOracle.sol';

contract VolatilityOracleTest {
  uint256 private constant UINT16_MODULO = 65536;
  using VolatilityOracle for VolatilityOracle.Timepoint[UINT16_MODULO];

  VolatilityOracle.Timepoint[UINT16_MODULO] public timepoints;

  uint32 initTime;
  uint32 public time;
  int24 public tick;
  uint16 public index;
  uint32 private step = 13;

  struct InitializeParams {
    uint32 time;
    int24 tick;
  }

  function initialize(InitializeParams calldata params) external {
    initTime = params.time;
    time = params.time;
    tick = params.tick;
    timepoints.initialize(params.time, tick);
  }

  function setState(uint32 _time, uint16 _index) external {
    time = _time;
    index = _index;
  }

  function writeTimepointDirectly(uint16 _index, VolatilityOracle.Timepoint memory timepoint) external {
    timepoints[_index] = timepoint;
  }

  function setStep(uint32 newStep) external {
    step = newStep;
  }

  function advanceTime(uint32 by) public {
    unchecked {
      time += by;
    }
  }

  struct UpdateParams {
    uint32 advanceTimeBy;
    int24 tick;
  }

  // write a timepoint, then change tick and liquidity
  function update(UpdateParams calldata params) external {
    uint16 _index = index;
    uint32 _time = time;
    int24 _tick = tick;
    unchecked {
      _time += params.advanceTimeBy;
    }

    (_index, ) = timepoints.write(_index, _time, _tick);
    _tick = params.tick;

    tick = _tick;
    index = _index;
    time = _time;
  }

  function batchUpdate(UpdateParams[] calldata params) external {
    // sload everything
    int24 _tick = tick;
    uint16 _index = index;
    uint32 _time = time;
    unchecked {
      for (uint256 i; i < params.length; ++i) {
        _time += params[i].advanceTimeBy;
        (_index, ) = timepoints.write(_index, _time, _tick);
        _tick = params[i].tick;
      }
    }

    // sstore everything
    tick = _tick;
    index = _index;
    time = _time;
  }

  struct UpdateParamsFixedTimedelta {
    int24 tick;
  }

  function batchUpdateFast(uint256 length) external {
    // sload everything
    int24 _tick = tick;
    uint32 _time = time;
    uint32 STEP = step;

    uint32 _initTime = initTime;
    uint256 _index = (_time - _initTime) / STEP;

    VolatilityOracle.Timepoint memory last = timepoints[uint16(_index)];

    unchecked {
      for (uint256 i; i < length; ++i) {
        _time += STEP;

        // get next index considering overflow
        uint16 nextIndex = uint16(_index + 1);

        int24 avgTick;
        uint16 windowStartIndex;

        if (_time - _initTime > 24 hours) {
          windowStartIndex = uint16(_index - (uint256(24 hours) / STEP) + 1); // CHECK
          avgTick = -int24(uint24((STEP * ((nextIndex + 1) * nextIndex - (windowStartIndex + 1) * windowStartIndex)) / (2 * uint256(24 hours))));
        } else {
          uint32 timeDelta = _time - _initTime;
          avgTick = -int24(uint24((STEP * (nextIndex + 1) * nextIndex) / (2 * uint256(timeDelta))));
        }

        last = VolatilityOracle._createNewTimepoint(last, _time, _tick, avgTick, windowStartIndex);

        if ((_index + 1) - uint256(_index - (uint256(24 hours) / STEP) + 1) > type(uint16).max) windowStartIndex = uint16(_index + 2);
        timepoints[uint16(nextIndex)] = last;

        _tick--;

        _index = _index + 1;
      }
    }

    // sstore everything
    tick = _tick;
    index = uint16(_index);
    time = _time;
  }

  function batchUpdateFixedTimedelta(uint256 length) external {
    // sload everything
    int24 _tick = tick;
    uint16 _index = index;
    uint32 _time = time;
    uint32 STEP = step;
    unchecked {
      for (uint256 i; i < length; ++i) {
        _time += STEP;
        (_index, ) = timepoints.write(_index, _time, _tick);
        _tick--;
      }
    }

    // sstore everything
    tick = _tick;
    index = _index;
    time = _time;
  }

  function getTimepoints(
    uint32[] calldata secondsAgos
  ) external view returns (int56[] memory tickCumulatives, uint88[] memory volatilityCumulatives) {
    return timepoints.getTimepoints(time, secondsAgos, tick, index);
  }

  function getOldestIndex() external view returns (uint16 oldestIndex) {
    return timepoints.getOldestIndex(index);
  }

  function getGasCostOfGetPoints(uint32[] calldata secondsAgos) external view returns (uint256) {
    (uint32 _time, int24 _tick, uint16 _index) = (time, tick, index);
    unchecked {
      uint256 gasBefore = gasleft();
      timepoints.getTimepoints(_time, secondsAgos, _tick, _index);
      return gasBefore - gasleft();
    }
  }

  function volatilityOnRange(uint32 dt, int24 tick0, int24 tick1, int24 avgTick0, int24 avgTick1) external pure returns (uint256) {
    return VolatilityOracle._volatilityOnRange(int256(uint256(dt)), tick0, tick1, avgTick0, avgTick1);
  }

  function getAverageVolatility() external view returns (uint88) {
    uint16 lastIndex = index;
    uint16 oldestIndex = timepoints.getOldestIndex(lastIndex);
    return timepoints.getAverageVolatility(time, tick, lastIndex, oldestIndex);
  }

  function getAverageTick() external view returns (int256) {
    uint32 lastTimestamp = timepoints[index].blockTimestamp;
    int56 lastTickCumulative = timepoints[index].tickCumulative;

    uint16 oldestIndex;
    if (timepoints[index + 1].initialized) {
      oldestIndex = index + 1;
    }

    (uint32 _time, int24 _tick, uint16 _index) = (time, tick, index);
    (int256 avgTick, ) = timepoints._getAverageTick(_time, _tick, _index, oldestIndex, lastTimestamp, lastTickCumulative);
    return int24(avgTick);
  }

  function getTickCumulativeAt(uint32 secondsAgo) external view returns (int256) {
    uint16 oldestIndex;
    if (timepoints[index + 1].initialized) {
      oldestIndex = index + 1;
    }

    (uint32 _time, int24 _tick, uint16 _index) = (time, tick, index);
    (int56 tickCumulative, ) = timepoints._getTickCumulativeAt(_time, secondsAgo, _tick, _index, oldestIndex);
    return int56(tickCumulative);
  }

  function window() external pure returns (uint256) {
    return VolatilityOracle.WINDOW;
  }
}
