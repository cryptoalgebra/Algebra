// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../AlgebraBasePluginV1.sol';

// used for testing time dependent behavior
contract MockTimeAlgebraBasePluginV1 is AlgebraBasePluginV1 {
  using VolatilityOracle for VolatilityOracle.Timepoint[UINT16_MODULO];

  // Monday, October 5, 2020 9:00:00 AM GMT-05:00
  uint256 public time = 1601906400;

  constructor(address _pool, address _factory, address _pluginFactory) {
    initialize(_pool, _factory, _pluginFactory);
  }

  function advanceTime(uint256 by) external {
    unchecked {
      time += by;
    }
  }

  function _blockTimestamp() internal view override returns (uint32) {
    return uint32(time);
  }

  struct UpdateParams {
    uint32 advanceTimeBy;
    int24 tick;
  }

  function batchUpdate(UpdateParams[] calldata params) external {
    VolatiltyOracleLayout storage vol = getVolatiltyOraclePointer();
    // sload everything
    uint16 _index = vol.timepointIndex;
    uint32 _time = vol.lastTimepointTimestamp;
    int24 _tick;
    unchecked {
      for (uint256 i; i < params.length; ++i) {
        _time += params[i].advanceTimeBy;
        _tick = params[i].tick;
        (_index, ) = vol.timepoints.write(_index, _time, _tick);
      }
    }

    // sstore everything
    vol.lastTimepointTimestamp = _time;
    vol.timepointIndex = _index;
    time = _time;
  }

  function checkBlockTimestamp() external view returns (bool) {
    require(super._blockTimestamp() == uint32(block.timestamp));
    return true;
  }

  function getTimepointsWithParams(
    uint32 _time,
    uint32[] memory secondsAgos,
    int24 tick,
    uint16 lastIndex
  ) external view returns (int56[] memory tickCumulatives, uint88[] memory volatilityCumulatives) {
    VolatiltyOracleLayout storage vol = getVolatiltyOraclePointer();
    return vol.timepoints.getTimepoints(_time, secondsAgos, tick, lastIndex);
  }

  function getAverageVolatility(uint32 timestamp, int24 tick) public view returns (uint88 volatilityAverage) {
    VolatiltyOracleLayout storage vol = getVolatiltyOraclePointer();
    uint16 index = vol.timepointIndex;
    uint16 oldestIndex = vol.timepoints.getOldestIndex(index);
    return vol.timepoints.getAverageVolatility(timestamp, tick, index, oldestIndex);
  }
}
