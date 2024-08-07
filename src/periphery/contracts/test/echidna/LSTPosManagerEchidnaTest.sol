// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../../libraries/LiquidityAmounts.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/TickMath.sol';

contract LSTPosManagerEchidnaTest {

  function echidna_calculateWithdrawalFees(
        uint16 withdrawalFee,
        uint256 token0apr,
        uint256 token1apr,
        uint32 period,
        int24 timeWeightedAverageTick,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) external pure {
        require(token0apr > 0 && token0apr < 1e3);
        require(token1apr > 0 && token1apr < 1e3);
        require(withdrawalFee > 0 && withdrawalFee < 1e3);
        require(timeWeightedAverageTick >= TickMath.MIN_TICK);
        require(timeWeightedAverageTick <= TickMath.MAX_TICK);
        require(tickLower < tickUpper);
        require(period < 365 days);

        uint128 withdrawalFeeLiquidity;
        uint128 amount0Fee;
        uint128 amount1Fee; 

        if ((token0apr > 0 || token1apr > 0) && withdrawalFee > 0) {

            (uint256 averageAmount0, uint256 averageAmount1) = LiquidityAmounts.getAmountsForLiquidity(
                TickMath.getSqrtRatioAtTick(timeWeightedAverageTick),
                TickMath.getSqrtRatioAtTick(tickLower),
                TickMath.getSqrtRatioAtTick(tickUpper),
                liquidity
            );

            if (token0apr > 0) {
                uint256 amount0EarnedFromStake = (token0apr * period * averageAmount0) / (1e3 * 365 days);
                amount0Fee = uint128((amount0EarnedFromStake * withdrawalFee) / 1e3);
                withdrawalFeeLiquidity += LiquidityAmounts.getLiquidityForAmount0(
                    TickMath.getSqrtRatioAtTick(tickLower),
                    TickMath.getSqrtRatioAtTick(tickUpper),
                    amount0Fee
                );
            }

            if (token1apr > 0) {
                uint256 amount1EarnedFromStake = (token1apr * period * averageAmount1) / (1e3 * 365 days);
                amount1Fee = uint128((amount1EarnedFromStake * withdrawalFee) / 1e3);
                withdrawalFeeLiquidity += LiquidityAmounts.getLiquidityForAmount1(
                    TickMath.getSqrtRatioAtTick(tickLower),
                    TickMath.getSqrtRatioAtTick(tickUpper),
                    amount1Fee
                );
            }

            (uint256 withdrawalAmount0, uint256 withdrawalAmount1) = LiquidityAmounts.getAmountsForLiquidity(
                TickMath.getSqrtRatioAtTick(timeWeightedAverageTick),
                TickMath.getSqrtRatioAtTick(tickLower),
                TickMath.getSqrtRatioAtTick(tickUpper),
                withdrawalFeeLiquidity
            );

            assert(withdrawalAmount0 <= amount0Fee);
            assert(withdrawalAmount1 <= amount1Fee);
            
        }

    }
}