// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.0 <0.9.0;

import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/TickMath.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/Constants.sol';
import '../interfaces/INonfungiblePositionManager.sol';
import './LiquidityAmounts.sol';
import './PoolAddress.sol';

/// @title Returns information about the token value held in a Algebra Integral NFT
/// @dev Credit to Uniswap Labs under GPL-2.0-or-later license:
/// https://github.com/Uniswap/v3-periphery
library PositionValue {
    struct PositionCache {
        address token0;
        address token1;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint256 feeGrowthInside0LastX128;
        uint256 feeGrowthInside1LastX128;
        uint256 tokensOwed0;
        uint256 tokensOwed1;
    }

    /// @notice Returns the total amounts of token0 and token1, i.e. the sum of fees and principal
    /// that a given nonfungible position manager token is worth
    /// @param positionManager The Algebra NonfungiblePositionManager
    /// @param tokenId The tokenId of the token for which to get the total value
    /// @param sqrtRatioX96 The square root price X96 for which to calculate the principal amounts
    /// @return amount0 The total amount of token0 including principal and fees
    /// @return amount1 The total amount of token1 including principal and fees
    function total(
        INonfungiblePositionManager positionManager,
        uint256 tokenId,
        uint160 sqrtRatioX96
    ) internal view returns (uint256 amount0, uint256 amount1) {
        PositionCache memory _position = _getPosition(positionManager, tokenId);
        (uint256 amount0Principal, uint256 amount1Principal) = _principal(
            sqrtRatioX96,
            _position.tickLower,
            _position.tickUpper,
            _position.liquidity
        );
        (uint256 amount0Fee, uint256 amount1Fee) = _fees(positionManager, _position);
        return (amount0Principal + amount0Fee, amount1Principal + amount1Fee);
    }

    /// @notice Calculates the principal (currently acting as liquidity) owed to the token owner in the event
    /// that the position is burned
    /// @param positionManager The Algebra NonfungiblePositionManager
    /// @param tokenId The tokenId of the token for which to get the total principal owed
    /// @param sqrtRatioX96 The square root price X96 for which to calculate the principal amounts
    /// @return amount0 The principal amount of token0
    /// @return amount1 The principal amount of token1
    function principal(
        INonfungiblePositionManager positionManager,
        uint256 tokenId,
        uint160 sqrtRatioX96
    ) internal view returns (uint256 amount0, uint256 amount1) {
        (, , , , int24 tickLower, int24 tickUpper, uint128 liquidity, , , , ) = positionManager.positions(tokenId);

        return _principal(sqrtRatioX96, tickLower, tickUpper, liquidity);
    }

    /// @notice Calculates the total fees owed to the token owner
    /// @param positionManager The Algebra NonfungiblePositionManager
    /// @param tokenId The tokenId of the token for which to get the total fees owed
    /// @return amount0 The amount of fees owed in token0
    /// @return amount1 The amount of fees owed in token1
    function fees(
        INonfungiblePositionManager positionManager,
        uint256 tokenId
    ) internal view returns (uint256 amount0, uint256 amount1) {
        return _fees(positionManager, _getPosition(positionManager, tokenId));
    }

    function _principal(
        uint160 sqrtRatioX96,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) private pure returns (uint256 amount0, uint256 amount1) {
        return
            LiquidityAmounts.getAmountsForLiquidity(
                sqrtRatioX96,
                TickMath.getSqrtRatioAtTick(tickLower),
                TickMath.getSqrtRatioAtTick(tickUpper),
                liquidity
            );
    }

    function _fees(
        INonfungiblePositionManager positionManager,
        PositionCache memory position
    ) private view returns (uint256 amount0, uint256 amount1) {
        unchecked {
            (uint256 poolFeeGrowthInside0LastX128, uint256 poolFeeGrowthInside1LastX128) = _getFeeGrowthInside(
                IAlgebraPool(
                    PoolAddress.computeAddress(
                        positionManager.poolDeployer(),
                        PoolAddress.PoolKey({token0: position.token0, token1: position.token1})
                    )
                ),
                position.tickLower,
                position.tickUpper
            );

            amount0 =
                FullMath.mulDiv(
                    poolFeeGrowthInside0LastX128 - position.feeGrowthInside0LastX128,
                    position.liquidity,
                    Constants.Q128
                ) +
                position.tokensOwed0;

            amount1 =
                FullMath.mulDiv(
                    poolFeeGrowthInside1LastX128 - position.feeGrowthInside1LastX128,
                    position.liquidity,
                    Constants.Q128
                ) +
                position.tokensOwed1;
        }
    }

    function _getPosition(
        INonfungiblePositionManager positionManager,
        uint256 tokenId
    ) private view returns (PositionCache memory) {
        (
            ,
            ,
            address token0,
            address token1,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        ) = positionManager.positions(tokenId);

        return
            PositionCache(
                token0,
                token1,
                tickLower,
                tickUpper,
                liquidity,
                feeGrowthInside0LastX128,
                feeGrowthInside1LastX128,
                tokensOwed0,
                tokensOwed1
            );
    }

    function _getFeeGrowthInside(
        IAlgebraPool pool,
        int24 bottomTick,
        int24 topTick
    ) private view returns (uint256 feeGrowthInside0X128, uint256 feeGrowthInside1X128) {
        (, int24 currentTick, , , , ) = pool.globalState();
        (uint256 lowerOuterFeeGrowth0Token, uint256 lowerOuterFeeGrowth1Token) = _getOuterFeeGrowth(pool, bottomTick);
        (uint256 upperOuterFeeGrowth0Token, uint256 upperOuterFeeGrowth1Token) = _getOuterFeeGrowth(pool, topTick);

        unchecked {
            if (currentTick < topTick) {
                if (currentTick >= bottomTick) {
                    uint256 feeGrowthGlobal0X128 = pool.totalFeeGrowth0Token();
                    uint256 feeGrowthGlobal1X128 = pool.totalFeeGrowth1Token();
                    feeGrowthInside0X128 = feeGrowthGlobal0X128 - lowerOuterFeeGrowth0Token;
                    feeGrowthInside1X128 = feeGrowthGlobal1X128 - lowerOuterFeeGrowth1Token;
                } else {
                    feeGrowthInside0X128 = lowerOuterFeeGrowth0Token;
                    feeGrowthInside1X128 = lowerOuterFeeGrowth1Token;
                }
                feeGrowthInside0X128 -= upperOuterFeeGrowth0Token;
                feeGrowthInside1X128 -= upperOuterFeeGrowth1Token;
            } else {
                feeGrowthInside0X128 = upperOuterFeeGrowth0Token - lowerOuterFeeGrowth0Token;
                feeGrowthInside1X128 = upperOuterFeeGrowth1Token - lowerOuterFeeGrowth1Token;
            }
        }
    }

    function _getOuterFeeGrowth(
        IAlgebraPool pool,
        int24 tick
    ) private view returns (uint256 outerFeeGrowth0Token, uint256 OuterFeeGrowth1Token) {
        (, , , , outerFeeGrowth0Token, OuterFeeGrowth1Token) = pool.ticks(tick);
    }
}
