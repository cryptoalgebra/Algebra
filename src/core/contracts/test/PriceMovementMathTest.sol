// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../libraries/PriceMovementMath.sol';
import '../libraries/TickMath.sol';

contract PriceMovementMathTest {
  function calculatePriceImpactFee(
    uint16 fee,
    int24 startTick,
    uint160 startPrice,
    uint160 currentPrice,
    uint160 endPrice
  ) external view returns (uint256) {
    int24 currentTick = TickMath.getTickAtSqrtRatio(currentPrice);
    (int32 startTickX100, ) = PriceMovementMath._interpolateTick(startPrice, TickMath.getSqrtRatioAtTick(startTick), int32(startTick) * 100, true);
    return PriceMovementMath.calculatePriceImpactFee(PriceMovementMath.ElasticFeeData(startTickX100, currentTick, fee), currentPrice, endPrice);
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
    int24 currentTick = TickMath.getTickAtSqrtRatio(sqrtP);
    PriceMovementMath.ElasticFeeData memory data = PriceMovementMath.ElasticFeeData(currentTick * 100, currentTick, feePips);
    return PriceMovementMath.movePriceTowardsTarget(sqrtPTarget < sqrtP, sqrtP, sqrtPTarget, liquidity, amountRemaining, data);
  }

  function getGasCostOfmovePriceTowardsTarget(
    uint160 sqrtP,
    uint160 sqrtPTarget,
    uint128 liquidity,
    int256 amountRemaining,
    uint16 feePips
  ) external view returns (uint256) {
    int24 currentTick = TickMath.getTickAtSqrtRatio(sqrtP);
    PriceMovementMath.ElasticFeeData memory data = PriceMovementMath.ElasticFeeData(currentTick * 100, currentTick, feePips);
    uint256 gasBefore = gasleft();
    PriceMovementMath.movePriceTowardsTarget(sqrtPTarget < sqrtP, sqrtP, sqrtPTarget, liquidity, amountRemaining, data);
    return gasBefore - gasleft();
  }
}
