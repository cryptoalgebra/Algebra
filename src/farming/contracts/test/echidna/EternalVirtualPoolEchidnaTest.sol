// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import './../TestVirtualPool.sol';

/// @notice Test designed to verify that the virtual pool will not deactivate when working correctly
contract EternalVirtualPoolEchidnaTest {
  /// @dev The minimum tick that may be passed to #getSqrtRatioAtTick computed from log base 1.0001 of 2**-128
  int24 internal constant MIN_TICK = -887272;
  /// @dev The maximum tick that may be passed to #getSqrtRatioAtTick computed from log base 1.0001 of 2**128
  int24 internal constant MAX_TICK = -MIN_TICK;

  TestVirtualPool private virtualPool;

  int24 currentTick = 0;

  constructor() {
    virtualPool = new TestVirtualPool(address(this), address(this));
  }

  function applyLiquidityDeltaToPosition(int24 bottomTick, int24 topTick, int128 liquidityDelta) external {
    bottomTick = _boundTick(bottomTick);
    topTick = _boundTick(topTick);

    if (bottomTick == topTick) return;

    if (topTick < bottomTick) (bottomTick, topTick) = (topTick, bottomTick);

    virtualPool.applyLiquidityDeltaToPosition(bottomTick, topTick, liquidityDelta, currentTick);

    assert(!virtualPool.deactivated());
    _checkNextAndPrevTicks();
  }

  function crossTo(int24 targetTick) external {
    targetTick = _boundTick(targetTick);
    if (targetTick == MAX_TICK) targetTick--; // it is impossible to cross MAX_TICK

    bool zeroToOne = targetTick <= currentTick;

    virtualPool.crossTo(targetTick, zeroToOne);
    currentTick = targetTick;

    assert(!virtualPool.deactivated());
    _checkNextAndPrevTicks();
  }

  function _boundTick(int24 tick) private pure returns (int24 boundedTick) {
    if (tick < MIN_TICK) return MIN_TICK;
    else if (tick > MAX_TICK) return MAX_TICK;
    return tick;
  }

  function _checkNextAndPrevTicks() private view {
    int24 prevTick = virtualPool.prevTick();
    int24 nextTick = virtualPool.nextTick();

    (, , , int24 _nextTick, , ) = virtualPool.ticks(prevTick);
    (, , int24 _prevTick, , , ) = virtualPool.ticks(nextTick);

    assert(prevTick == _prevTick);
    assert(nextTick == _nextTick);
  }
}
