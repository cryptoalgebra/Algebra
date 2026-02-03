// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '../farmings/EternalVirtualPool.sol';

/// @dev Test contract for Eternal virtual pool
contract TestVirtualPool is EternalVirtualPool {
  constructor(address _farmingAddress, address _plugin) EternalVirtualPool(_farmingAddress, _plugin) {
    //
  }

  function nextTick() external view returns (int24) {
    return globalNextInitializedTick;
  }

  function prevTick() external view returns (int24) {
    return globalPrevInitializedTick;
  }

  function getTotalFeeGrowth0Internal() external view returns (uint256) {
    return _totalFeeGrowth0;
  }

  function getTotalFeeGrowth1Internal() external view returns (uint256) {
    return _totalFeeGrowth1;
  }

  function setGlobalTick(int24 tick) external {
    globalTick = tick;
  }

  function setCurrentLiquidity(uint128 liquidity_) external {
    currentLiquidity = liquidity_;
  }
}
