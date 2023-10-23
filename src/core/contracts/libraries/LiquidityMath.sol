// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.4 <0.9.0;

import '../interfaces/pool/IAlgebraPoolErrors.sol';
import './TickMath.sol';
import './TokenDeltaMath.sol';

/// @title Math library for liquidity
/// @dev Credit to Uniswap Labs under GPL-2.0-or-later license:
/// https://github.com/Uniswap/v3-core/blob/main/contracts/libraries
library LiquidityMath {
  /// @notice Add a signed liquidity delta to liquidity and revert if it overflows or underflows
  /// @param x The liquidity before change
  /// @param y The delta by which liquidity should be changed
  /// @return z The liquidity delta
  function addDelta(uint128 x, int128 y) internal pure returns (uint128 z) {
    unchecked {
      if (y < 0) {
        if ((z = x - uint128(-y)) >= x) revert IAlgebraPoolErrors.liquiditySub();
      } else {
        if ((z = x + uint128(y)) < x) revert IAlgebraPoolErrors.liquidityAdd();
      }
    }
  }

  function getAmountsForLiquidity(
    int24 bottomTick,
    int24 topTick,
    int128 liquidityDelta,
    int24 currentTick,
    uint160 currentPrice
  ) internal pure returns (uint256 amount0, uint256 amount1, int128 globalLiquidityDelta) {
    uint160 priceAtBottomTick = TickMath.getSqrtRatioAtTick(bottomTick);
    uint160 priceAtTopTick = TickMath.getSqrtRatioAtTick(topTick);

    int256 amount0Int;
    int256 amount1Int;
    if (currentTick < bottomTick) {
      // If current tick is less than the provided bottom one then only the token0 has to be provided
      amount0Int = TokenDeltaMath.getToken0Delta(priceAtBottomTick, priceAtTopTick, liquidityDelta);
    } else if (currentTick < topTick) {
      amount0Int = TokenDeltaMath.getToken0Delta(currentPrice, priceAtTopTick, liquidityDelta);
      amount1Int = TokenDeltaMath.getToken1Delta(priceAtBottomTick, currentPrice, liquidityDelta);
      globalLiquidityDelta = liquidityDelta;
    } else {
      // If current tick is greater than the provided top one then only the token1 has to be provided
      amount1Int = TokenDeltaMath.getToken1Delta(priceAtBottomTick, priceAtTopTick, liquidityDelta);
    }

    unchecked {
      (amount0, amount1) = liquidityDelta < 0 ? (uint256(-amount0Int), uint256(-amount1Int)) : (uint256(amount0Int), uint256(amount1Int));
    }
  }
}
