// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../../libraries/TickMath.sol';
import '../../libraries/LiquidityMath.sol';

contract LiquidityMathEchidnaTest {
  function addDelta(uint128 x, int128 y) external pure {
    uint128 result = LiquidityMath.addDelta(x, y);

    if (y < 0) assert(result < x);
    if (y == 0) assert(result == x);
    if (y > 0) assert(result > x);
  }

  function checkGetAmountsForLiquidity(int24 bottomTick, int24 topTick, int128 liquidityDelta, uint160 currentPrice) external pure {
    require(topTick > bottomTick);
    require(bottomTick >= TickMath.MIN_TICK);
    require(topTick <= TickMath.MAX_TICK);
    require(currentPrice >= TickMath.MIN_SQRT_RATIO);
    require(currentPrice <= TickMath.MAX_SQRT_RATIO);

    int24 currentTick = TickMath.getTickAtSqrtRatio(currentPrice);

    (uint256 amount0, uint256 amount1, int128 globalLiquidityDelta) = LiquidityMath.getAmountsForLiquidity(
      bottomTick,
      topTick,
      liquidityDelta,
      currentTick,
      currentPrice
    );

    if (liquidityDelta > 0) assert(globalLiquidityDelta >= 0);
    if (currentTick >= bottomTick && currentTick < topTick && liquidityDelta != 0) assert(globalLiquidityDelta == liquidityDelta);
    else assert(globalLiquidityDelta == 0);

    if (liquidityDelta == 0) assert(amount0 == 0 && amount1 == 0);
  }
}
