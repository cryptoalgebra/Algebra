// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.17;

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

  function getAverageVolatility(uint32 timestamp, int24 tick, uint16 index) public view returns (uint88 volatilityAverage) {
    uint16 oldestIndex = timepoints.getOldestIndex(index);
    uint88 lastVolatilityCumulative = timepoints._getVolatilityCumulativeAt(timestamp, 0, tick, index, oldestIndex);
    return timepoints.getAverageVolatility(timestamp, tick, index, oldestIndex, lastVolatilityCumulative);
  }

  /// @notice Calculates fee based on combination of sigmoids
  /// @param _time The current block.timestamp
  /// @param tick The current tick
  /// @param lastIndex The index of the timepoint that was most recently written to the timepoints array
  /// @return fee The fee in hundredths of a bip, i.e. 1e-6
  function getFee(uint32 _time, int24 tick, uint16 lastIndex) external view returns (uint16 fee) {
    uint16 oldestIndex = timepoints.getOldestIndex(lastIndex);
    uint88 lastVolatilityCumulative = timepoints._getVolatilityCumulativeAt(_time, 0, tick, lastIndex, oldestIndex);
    uint88 volatilityAverage = timepoints.getAverageVolatility(_time, tick, lastIndex, oldestIndex, lastVolatilityCumulative);
    return AdaptiveFee.getFee(volatilityAverage, feeConfig);
  }

  /// @dev pay for storage slots
  function prepayTimepointsStorage(uint16 startIndex, uint16 amount) external {
    require(!timepoints[startIndex].initialized);
    require(amount > 0);

    unchecked {
      for (uint256 i = startIndex; i < startIndex + amount; ++i) {
        timepoints[i].blockTimestamp = 1;
      }
    }
  }
}
