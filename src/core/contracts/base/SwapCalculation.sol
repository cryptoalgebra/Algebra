// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import '../libraries/PriceMovementMath.sol';
import '../libraries/LowGasSafeMath.sol';
import '../libraries/SafeCast.sol';
import './AlgebraPoolBase.sol';

/// @title Algebra swap calculation abstract contract
/// @notice Contains _calculateSwap encapsulating internal logic of swaps
abstract contract SwapCalculation is AlgebraPoolBase {
  using TickManagement for mapping(int24 => TickManagement.Tick);
  using SafeCast for uint256;
  using LowGasSafeMath for uint256;
  using LowGasSafeMath for int256;

  struct SwapCalculationCache {
    uint256 communityFee; // The community fee of the selling token, uint256 to minimize casts
    bool crossedAnyTick; //  If we have already crossed at least one active tick
    int256 amountRequiredInitial; // The initial value of the exact input\output amount
    int256 amountCalculated; // The additive amount of total output\input calculated through the swap
    uint256 totalFeeGrowth; // The initial totalFeeGrowth + the fee growth during a swap
    uint256 totalFeeGrowthB;
    bool exactInput; // Whether the exact input or output is specified
    uint16 fee; // The current dynamic fee
    int24 prevInitializedTick; // The previous initialized tick in linked list
    uint128 liquidityAtStart;
  }

  struct PriceMovementCache {
    uint160 stepSqrtPrice; // The Q64.96 sqrt of the price at the start of the step
    uint160 nextTickPrice; // The Q64.96 sqrt of the price calculated from the _nextTick_
    uint256 input; // The additive amount of tokens that have been provided
    uint256 output; // The additive amount of token that have been withdrawn
    uint256 feeAmount; // The total amount of fee earned within a current step
  }

  function _calculateSwap(
    bool zeroToOne,
    int256 amountRequired,
    uint160 limitSqrtPrice
  ) internal returns (int256 amount0, int256 amount1, uint160 currentPrice, int24 currentTick, uint128 currentLiquidity, uint256 communityFeeAmount) {
    if (amountRequired == 0) revert zeroAmountRequired();
    if (amountRequired == type(int256).min) revert invalidAmountRequired(); // to avoid problems when changing sign
    SwapCalculationCache memory cache;
    {
      // load from one storage slot
      currentPrice = globalState.price;
      currentTick = globalState.tick;
      cache.prevInitializedTick = globalState.prevInitializedTick;
      cache.fee = globalState.fee;
      cache.communityFee = globalState.communityFee;

      (cache.amountRequiredInitial, cache.exactInput) = (amountRequired, amountRequired > 0);

      currentLiquidity = liquidity;
      cache.liquidityAtStart = currentLiquidity;

      if (zeroToOne) {
        if (limitSqrtPrice >= currentPrice || limitSqrtPrice <= TickMath.MIN_SQRT_RATIO) revert invalidLimitSqrtPrice();
        cache.totalFeeGrowth = totalFeeGrowth0Token;
      } else {
        if (limitSqrtPrice <= currentPrice || limitSqrtPrice >= TickMath.MAX_SQRT_RATIO) revert invalidLimitSqrtPrice();
        cache.totalFeeGrowth = totalFeeGrowth1Token;
      }
    }

    PriceMovementCache memory step;
    unchecked {
      // swap until there is remaining input or output tokens or we reach the price limit
      while (true) {
        int24 nextTick = zeroToOne ? cache.prevInitializedTick : ticks[cache.prevInitializedTick].nextTick;
        step.stepSqrtPrice = currentPrice;
        step.nextTickPrice = TickMath.getSqrtRatioAtTick(nextTick);

        (currentPrice, step.input, step.output, step.feeAmount) = PriceMovementMath.movePriceTowardsTarget(
          zeroToOne,
          currentPrice,
          (zeroToOne == (step.nextTickPrice < limitSqrtPrice)) // move the price to the target or to the limit
            ? limitSqrtPrice
            : step.nextTickPrice,
          currentLiquidity,
          amountRequired,
          cache.fee
        );

        if (cache.exactInput) {
          amountRequired -= (step.input + step.feeAmount).toInt256(); // decrease remaining input amount
          cache.amountCalculated = cache.amountCalculated.sub(step.output.toInt256()); // decrease calculated output amount
        } else {
          amountRequired += step.output.toInt256(); // increase remaining output amount (since its negative)
          cache.amountCalculated = cache.amountCalculated.add((step.input + step.feeAmount).toInt256()); // increase calculated input amount
        }

        if (cache.communityFee > 0) {
          uint256 delta = (step.feeAmount.mul(cache.communityFee)) / Constants.COMMUNITY_FEE_DENOMINATOR;
          step.feeAmount -= delta;
          communityFeeAmount += delta;
        }

        if (currentLiquidity > 0) cache.totalFeeGrowth += FullMath.mulDiv(step.feeAmount, Constants.Q128, currentLiquidity);

        // min or max tick can not be crossed due to limitSqrtPrice check
        if (currentPrice == step.nextTickPrice) {
          // if the reached tick is initialized then we need to cross it
          if (!cache.crossedAnyTick) {
            cache.crossedAnyTick = true;
            cache.totalFeeGrowthB = zeroToOne ? totalFeeGrowth1Token : totalFeeGrowth0Token;
          }

          int128 liquidityDelta;
          if (zeroToOne) {
            liquidityDelta = -ticks.cross(
              nextTick,
              cache.totalFeeGrowth, // A == 0
              cache.totalFeeGrowthB // B == 1
            );
            currentTick = nextTick - 1;
            cache.prevInitializedTick = ticks[cache.prevInitializedTick].prevTick;
          } else {
            liquidityDelta = ticks.cross(
              nextTick,
              cache.totalFeeGrowthB, // B == 0
              cache.totalFeeGrowth // A == 1
            );
            currentTick = nextTick;
            cache.prevInitializedTick = currentTick;
          }
          currentLiquidity = LiquidityMath.addDelta(currentLiquidity, liquidityDelta);
        } else if (currentPrice != step.stepSqrtPrice) {
          // if the price has changed but hasn't reached the target
          currentTick = TickMath.getTickAtSqrtRatio(currentPrice);
          break; // since the price hasn't reached the target, amountRequired should be 0
        }
        // check stop condition
        if (amountRequired == 0 || currentPrice == limitSqrtPrice) {
          break; // TODO recheck if on tick
        }
      }

      (amount0, amount1) = zeroToOne == cache.exactInput // the amount to provide could be less than initially specified (e.g. reached limit)
        ? (cache.amountRequiredInitial - amountRequired, cache.amountCalculated) // the amount to get could be less than initially specified (e.g. reached limit)
        : (cache.amountCalculated, cache.amountRequiredInitial - amountRequired);
    }

    (globalState.price, globalState.tick, globalState.prevInitializedTick) = (currentPrice, currentTick, cache.prevInitializedTick);

    if (currentLiquidity != cache.liquidityAtStart) {
      liquidity = currentLiquidity;
    }
    if (zeroToOne) {
      totalFeeGrowth0Token = cache.totalFeeGrowth;
    } else {
      totalFeeGrowth1Token = cache.totalFeeGrowth;
    }
  }
}
