// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import './../../farmings/EternalVirtualPool.sol';

contract EternalVirtualPoolEchidnaTest {
  EternalVirtualPool private virtualPool;

  int24 currentTick = 0;

  constructor() {
    virtualPool = new EternalVirtualPool(address(this), address(this));
  }

  function applyLiquidityDeltaToPosition(int24 bottomTick, int24 topTick, int128 liquidityDelta) external {
    virtualPool.applyLiquidityDeltaToPosition(bottomTick, topTick, liquidityDelta, currentTick);

    assert(!virtualPool.deactivated());
  }

  function crossTo(int24 targetTick) external {
    bool zeroToOne = targetTick <= currentTick;

    virtualPool.crossTo(targetTick, zeroToOne);
    currentTick = targetTick;

    assert(!virtualPool.deactivated());
  }
}
