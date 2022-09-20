// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../libraries/TokenDeltaMath.sol';
import '../libraries/PriceMovementMath.sol';

contract TokenDeltaMathTest {
  function getNewPriceAfterInput(
    uint160 sqrtP,
    uint128 liquidity,
    uint256 amountIn,
    bool zeroToOne
  ) external pure returns (uint160 sqrtQ) {
    return PriceMovementMath.getNewPriceAfterInput(zeroToOne, sqrtP, liquidity, amountIn);
  }

  function getGasCostOfGetNewPriceAfterInput(
    uint160 sqrtP,
    uint128 liquidity,
    uint256 amountIn,
    bool zeroToOne
  ) external view returns (uint256) {
    uint256 gasBefore = gasleft();
    PriceMovementMath.getNewPriceAfterInput(zeroToOne, sqrtP, liquidity, amountIn);
    return gasBefore - gasleft();
  }

  function getNewPriceAfterOutput(
    uint160 sqrtP,
    uint128 liquidity,
    uint256 amountOut,
    bool zeroToOne
  ) external pure returns (uint160 sqrtQ) {
    return PriceMovementMath.getNewPriceAfterOutput(zeroToOne, sqrtP, liquidity, amountOut);
  }

  function getGasCostOfGetNewPriceAfterOutput(
    uint160 sqrtP,
    uint128 liquidity,
    uint256 amountOut,
    bool zeroToOne
  ) external view returns (uint256) {
    uint256 gasBefore = gasleft();
    PriceMovementMath.getNewPriceAfterOutput(zeroToOne, sqrtP, liquidity, amountOut);
    return gasBefore - gasleft();
  }

  function getToken0Delta(
    uint160 sqrtLower,
    uint160 sqrtUpper,
    uint128 liquidity,
    bool roundUp
  ) external pure returns (uint256 amount0) {
    return TokenDeltaMath.getToken0Delta(sqrtLower, sqrtUpper, liquidity, roundUp);
  }

  function getToken1Delta(
    uint160 sqrtLower,
    uint160 sqrtUpper,
    uint128 liquidity,
    bool roundUp
  ) external pure returns (uint256 amount1) {
    return TokenDeltaMath.getToken1Delta(sqrtLower, sqrtUpper, liquidity, roundUp);
  }

  function getGasCostOfGetToken0Delta(
    uint160 sqrtLower,
    uint160 sqrtUpper,
    uint128 liquidity,
    bool roundUp
  ) external view returns (uint256) {
    uint256 gasBefore = gasleft();
    TokenDeltaMath.getToken0Delta(sqrtLower, sqrtUpper, liquidity, roundUp);
    return gasBefore - gasleft();
  }

  function getGasCostOfGetToken1Delta(
    uint160 sqrtLower,
    uint160 sqrtUpper,
    uint128 liquidity,
    bool roundUp
  ) external view returns (uint256) {
    uint256 gasBefore = gasleft();
    TokenDeltaMath.getToken1Delta(sqrtLower, sqrtUpper, liquidity, roundUp);
    return gasBefore - gasleft();
  }
}
