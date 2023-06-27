// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.17;

import '../DataStorageOperator.sol';

// used for testing time dependent behavior
contract MockTimeDataStorageOperator is DataStorageOperator {
  using DataStorage for DataStorage.Timepoint[UINT16_MODULO];

  // Monday, October 5, 2020 9:00:00 AM GMT-05:00
  uint256 public time = 1601906400;

  constructor(address _pool, address _factory, address _pluginFactory) DataStorageOperator(_pool, _factory, _pluginFactory) {
    //
  }

  function advanceTime(uint256 by) external {
    unchecked {
      time += by;
    }
  }

  function _blockTimestamp() internal view override returns (uint32) {
    return uint32(time);
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
  ) external view returns (int56[] memory tickCumulatives, uint112[] memory volatilityCumulatives) {
    return timepoints.getTimepoints(_time, secondsAgos, tick, lastIndex);
  }

  function getAverageVolatility(uint32 timestamp, int24 tick) public view returns (uint88 volatilityAverage) {
    uint16 index = timepointIndex;
    uint16 oldestIndex = timepoints.getOldestIndex(index);
    uint88 lastVolatilityCumulative = timepoints._getVolatilityCumulativeAt(timestamp, 0, tick, index, oldestIndex);
    return timepoints.getAverageVolatility(timestamp, tick, index, oldestIndex, lastVolatilityCumulative);
  }
}