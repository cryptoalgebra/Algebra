// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../libraries/PriceMovementMath.sol';
import '../libraries/TickMath.sol';

contract PriceMovementMathTest {
  function calculatePriceImpactFee(
    uint16 fee,
    int24 startTick,
    uint160 currentPrice,
    uint160 endPrice
  ) external view returns (uint256) {
    return PriceMovementMath.calculatePriceImpactFee(fee, startTick, currentPrice, endPrice);
  }

  function movePriceTowardsTarget(
    uint160 sqrtP,
    uint160 sqrtPTarget,
    uint128 liquidity,
    int256 amountRemaining,
    uint16 feePips
  )
    external
    view
    returns (
      uint160 sqrtQ,
      uint256 amountIn,
      uint256 amountOut,
      uint256 feeAmount
    )
  {
    int24 tickStart = TickMath.getTickAtSqrtRatio(sqrtP);
    return PriceMovementMath.movePriceTowardsTarget(sqrtPTarget < sqrtP, sqrtP, sqrtPTarget, liquidity, amountRemaining, tickStart, feePips);
  }

  function getGasCostOfmovePriceTowardsTarget(
    uint160 sqrtP,
    uint160 sqrtPTarget,
    uint128 liquidity,
    int256 amountRemaining,
    uint16 feePips
  ) external view returns (uint256) {
    int24 tickStart = TickMath.getTickAtSqrtRatio(sqrtP);
    uint256 gasBefore = gasleft();
    PriceMovementMath.movePriceTowardsTarget(sqrtPTarget < sqrtP, sqrtP, sqrtPTarget, liquidity, amountRemaining, tickStart, feePips);
    return gasBefore - gasleft();
  }
}
