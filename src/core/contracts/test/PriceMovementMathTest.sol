// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;
pragma abicoder v1;

import '../libraries/PriceMovementMath.sol';
import '../libraries/TickMath.sol';

contract PriceMovementMathTest {
  function movePriceTowardsTarget(
    uint160 sqrtP,
    uint160 sqrtPTarget,
    uint128 liquidity,
    int256 amountRemaining,
    uint24 feePips
  ) external pure returns (uint160 sqrtQ, uint256 amountIn, uint256 amountOut, uint256 feeAmount) {
    return PriceMovementMath.movePriceTowardsTarget(sqrtPTarget < sqrtP, sqrtP, sqrtPTarget, liquidity, amountRemaining, feePips);
  }

  function getGasCostOfmovePriceTowardsTarget(
    uint160 sqrtP,
    uint160 sqrtPTarget,
    uint128 liquidity,
    int256 amountRemaining,
    uint24 feePips
  ) external view returns (uint256) {
    unchecked {
      uint256 gasBefore = gasleft();
      PriceMovementMath.movePriceTowardsTarget(sqrtPTarget < sqrtP, sqrtP, sqrtPTarget, liquidity, amountRemaining, feePips);
      return gasBefore - gasleft();
    }
  }
}
