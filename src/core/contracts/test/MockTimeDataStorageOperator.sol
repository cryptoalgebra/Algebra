// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;
pragma abicoder v2;

import '../DataStorageOperator.sol';

// used for testing time dependent behavior
contract MockTimeDataStorageOperator is DataStorageOperator {
  using DataStorage for DataStorage.Timepoint[UINT16_MODULO];

  // Monday, October 5, 2020 9:00:00 AM GMT-05:00
  uint256 public time = 1601906400;

  constructor(address _pool) DataStorageOperator(_pool) {
    //
  }

  function advanceTime(uint256 by) external {
    time += by;
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

  function getAverageVolatility(uint32 timestamp, int24 tick, uint16 index) public view returns (uint88 volatilityAverage) {
    uint16 oldestIndex = timepoints.getOldestIndex(index);
    uint88 lastVolatilityCumulative = timepoints.getVolatilityCumulativeAt(timestamp, 0, tick, index, oldestIndex);
    return timepoints.getAverageVolatility(timestamp, tick, index, oldestIndex, lastVolatilityCumulative);
  }
}
