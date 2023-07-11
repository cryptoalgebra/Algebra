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
    uint256 totalFeeGrowthInput; // The initial totalFeeGrowth + the fee growth during a swap
    uint256 totalFeeGrowthOutput; // The initial totalFeeGrowth for output token, should not change during swap
    bool exactInput; // Whether the exact input or output is specified
    uint16 fee; // The current dynamic fee
    int24 prevInitializedTick; // The previous initialized tick in linked list
    int24 nextInitializedTick; // The next initialized tick in linked list
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
    (cache.amountRequiredInitial, cache.exactInput) = (amountRequired, amountRequired > 0);

    // load from one storage slot
    (currentPrice, currentTick, cache.fee, cache.communityFee) = (globalState.price, globalState.tick, globalState.fee, globalState.communityFee);
    // load from one storage slot too
    (currentLiquidity, cache.prevInitializedTick, cache.nextInitializedTick) = (liquidity, prevTickGlobal, nextTickGlobal);

    if (zeroToOne) {
      if (limitSqrtPrice >= currentPrice || limitSqrtPrice <= TickMath.MIN_SQRT_RATIO) revert invalidLimitSqrtPrice();
      cache.totalFeeGrowthInput = totalFeeGrowth0Token;
    } else {
      if (limitSqrtPrice <= currentPrice || limitSqrtPrice >= TickMath.MAX_SQRT_RATIO) revert invalidLimitSqrtPrice();
      cache.totalFeeGrowthInput = totalFeeGrowth1Token;
    }

    PriceMovementCache memory step;
    unchecked {
      // swap until there is remaining input or output tokens or we reach the price limit
      do {
        int24 nextTick = zeroToOne ? cache.prevInitializedTick : cache.nextInitializedTick;
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

        if (currentLiquidity > 0) cache.totalFeeGrowthInput += FullMath.mulDiv(step.feeAmount, Constants.Q128, currentLiquidity);

        // min or max tick can not be crossed due to limitSqrtPrice check
        if (currentPrice == step.nextTickPrice) {
          // crossing tick
          if (!cache.crossedAnyTick) {
            cache.crossedAnyTick = true;
            cache.totalFeeGrowthOutput = zeroToOne ? totalFeeGrowth1Token : totalFeeGrowth0Token;
          }

          int128 liquidityDelta;
          if (zeroToOne) {
            liquidityDelta = -ticks.cross(
              nextTick,
              cache.totalFeeGrowthInput, // input == 0
              cache.totalFeeGrowthOutput // output == 1
            );
            currentTick = nextTick - 1;
            cache.prevInitializedTick = ticks[nextTick].prevTick;
            cache.nextInitializedTick = nextTick;
          } else {
            liquidityDelta = ticks.cross(
              nextTick,
              cache.totalFeeGrowthOutput, // output == 0
              cache.totalFeeGrowthInput // input == 1
            );
            currentTick = nextTick;
            cache.prevInitializedTick = nextTick;
            cache.nextInitializedTick = ticks[nextTick].nextTick;
          }
          currentLiquidity = LiquidityMath.addDelta(currentLiquidity, liquidityDelta);
        } else if (currentPrice != step.stepSqrtPrice) {
          // if the price has changed but hasn't reached the target
          currentTick = TickMath.getTickAtSqrtRatio(currentPrice);
          break; // since the price hasn't reached the target, amountRequired should be 0
        }
      } while (amountRequired != 0 && currentPrice != limitSqrtPrice); // check stop condition

      (amount0, amount1) = zeroToOne == cache.exactInput // the amount to provide could be less than initially specified (e.g. reached limit)
        ? (cache.amountRequiredInitial - amountRequired, cache.amountCalculated) // the amount to get could be less than initially specified (e.g. reached limit)
        : (cache.amountCalculated, cache.amountRequiredInitial - amountRequired);
    }

    (globalState.price, globalState.tick) = (currentPrice, currentTick);

    if (cache.crossedAnyTick) {
      (liquidity, prevTickGlobal, nextTickGlobal) = (currentLiquidity, cache.prevInitializedTick, cache.nextInitializedTick);
    }
    if (zeroToOne) {
      totalFeeGrowth0Token = cache.totalFeeGrowthInput;
    } else {
      totalFeeGrowth1Token = cache.totalFeeGrowthInput;
    }
  }
}
