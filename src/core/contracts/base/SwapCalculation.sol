// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

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
    uint256 totalFeeGrowthFeeToken; // The initial totalFeeGrowth for the fee token + the fee growth during a swap
    uint256 totalFeeGrowthOther; // The initial totalFeeGrowth for the other token, should not change during swap
    bool exactInput; // Whether the exact input or output is specified
    uint24 fee; // The current fee value in hundredths of a bip, i.e. 1e-6
    int24 prevInitializedTick; // The previous initialized tick in linked list
    int24 nextInitializedTick; // The next initialized tick in linked list
    uint24 pluginFee;
    bool feeTokenIsZero; // Whether the fee is collected in token0
    bool feeOnInput; // Whether the fee token is the input token of this swap
  }

  struct PriceMovementCache {
    uint256 stepSqrtPrice; // The Q64.96 sqrt of the price at the start of the step, uint256 to minimize casts
    uint256 nextTickPrice; // The Q64.96 sqrt of the price calculated from the _nextTick_, uint256 to minimize casts
    uint160 targetPrice; // The nearest of the next tick price and the limit price
    int24 nextTick; // The next initialized tick in the direction of the swap
    uint256 input; // The additive amount of tokens that have been provided
    uint256 output; // The additive amount of token that have been withdrawn
    uint256 feeAmount; // The total amount of fee earned within a current step
  }

  struct FeesAmount {
    uint256 communityFeeAmount;
    uint256 pluginFeeAmount;
    bool inToken0; // Whether the amounts above are in token0
  }

  function _calculateSwap(
    uint24 overrideFee,
    uint24 pluginFee,
    bool zeroToOne,
    int256 amountRequired,
    uint160 limitSqrtPrice
  ) internal returns (int256 amount0, int256 amount1, uint160 currentPrice, int24 currentTick, uint128 currentLiquidity, FeesAmount memory fees) {
    if (amountRequired == 0) revert zeroAmountRequired();
    if (amountRequired == type(int256).min) revert invalidAmountRequired(); // to avoid problems when changing sign

    SwapCalculationCache memory cache;
    (cache.amountRequiredInitial, cache.exactInput, cache.pluginFee) = (amountRequired, amountRequired > 0, pluginFee);

    // load from one storage slot
    (currentLiquidity, cache.prevInitializedTick, cache.nextInitializedTick) = (liquidity, prevTickGlobal, nextTickGlobal);

    // load from one storage slot too
    (currentPrice, currentTick, cache.fee, cache.communityFee) = (globalState.price, globalState.tick, globalState.lastFee, globalState.communityFee);
    if (currentPrice == 0) revert notInitialized();
    if (overrideFee != 0) {
      cache.fee = overrideFee + pluginFee;
      if (cache.fee >= 1e6) revert incorrectPluginFee();
    } else {
      if (pluginFee != 0) {
        cache.fee += pluginFee;
        if (cache.fee >= 1e6) revert incorrectPluginFee();
      }
    }

    if (zeroToOne) {
      if (limitSqrtPrice >= currentPrice || limitSqrtPrice <= TickMath.MIN_SQRT_RATIO) revert invalidLimitSqrtPrice();
    } else {
      if (limitSqrtPrice <= currentPrice || limitSqrtPrice >= TickMath.MAX_SQRT_RATIO) revert invalidLimitSqrtPrice();
    }

    {
      // only the fee token accrues fee growth during a swap, so the accumulator follows it, not the swap direction
      uint8 feeMode = globalState.feeMode;
      cache.feeTokenIsZero = feeMode == Constants.FEE_MODE_DEFAULT ? zeroToOne : feeMode == Constants.FEE_MODE_TOKEN0;
    }
    cache.feeOnInput = cache.feeTokenIsZero == zeroToOne;
    (cache.totalFeeGrowthFeeToken, fees.inToken0) = cache.feeTokenIsZero ? (totalFeeGrowth0Token, true) : (totalFeeGrowth1Token, false);

    PriceMovementCache memory step;
    unchecked {
      // swap until there is remaining input or output tokens or we reach the price limit
      do {
        step.nextTick = zeroToOne ? cache.prevInitializedTick : cache.nextInitializedTick;
        step.stepSqrtPrice = currentPrice;
        step.nextTickPrice = TickMath.getSqrtRatioAtTick(step.nextTick);

        // move the price to the nearest of the next tick and the limit price
        step.targetPrice = (zeroToOne == (step.nextTickPrice < limitSqrtPrice)) ? limitSqrtPrice : uint160(step.nextTickPrice); // cast is safe

        (currentPrice, step.input, step.output, step.feeAmount) = PriceMovementMath.movePriceTowardsTarget(
          cache.feeOnInput,
          zeroToOne, // if zeroToOne then the price is moving down
          currentPrice,
          step.targetPrice,
          currentLiquidity,
          amountRequired,
          cache.fee
        );

        if (cache.feeOnInput) step.input += step.feeAmount; // otherwise the fee is already subtracted from `step.output`
        if (cache.exactInput) {
          amountRequired -= step.input.toInt256(); // decrease remaining input amount
          cache.amountCalculated = cache.amountCalculated.sub(step.output.toInt256()); // decrease calculated output amount
        } else {
          amountRequired += step.output.toInt256(); // increase remaining output amount (since its negative)
          cache.amountCalculated = cache.amountCalculated.add(step.input.toInt256()); // increase calculated input amount
        }

        if (cache.communityFee > 0) {
          uint256 delta = (step.feeAmount.mul(cache.communityFee)) / Constants.COMMUNITY_FEE_DENOMINATOR;
          step.feeAmount -= delta;
          fees.communityFeeAmount += delta;
        }

        if (cache.pluginFee > 0 && cache.fee > 0) {
          uint256 delta = FullMath.mulDiv(step.feeAmount, cache.pluginFee, cache.fee);
          step.feeAmount -= delta;
          fees.pluginFeeAmount += delta;
        }

        if (currentLiquidity > 0) cache.totalFeeGrowthFeeToken += FullMath.mulDiv(step.feeAmount, Constants.Q128, currentLiquidity);

        // min or max tick can not be crossed due to limitSqrtPrice check
        if (currentPrice == step.nextTickPrice) {
          // crossing tick
          if (!cache.crossedAnyTick) {
            cache.crossedAnyTick = true;
            cache.totalFeeGrowthOther = cache.feeTokenIsZero ? totalFeeGrowth1Token : totalFeeGrowth0Token;
          }

          (uint256 feeGrowth0, uint256 feeGrowth1) = cache.feeTokenIsZero
            ? (cache.totalFeeGrowthFeeToken, cache.totalFeeGrowthOther)
            : (cache.totalFeeGrowthOther, cache.totalFeeGrowthFeeToken);

          int128 liquidityDelta;
          if (zeroToOne) {
            (liquidityDelta, cache.prevInitializedTick, ) = ticks.cross(step.nextTick, feeGrowth0, feeGrowth1);
            liquidityDelta = -liquidityDelta;
            (currentTick, cache.nextInitializedTick) = (step.nextTick - 1, step.nextTick);
          } else {
            (liquidityDelta, , cache.nextInitializedTick) = ticks.cross(step.nextTick, feeGrowth0, feeGrowth1);
            (currentTick, cache.prevInitializedTick) = (step.nextTick, step.nextTick);
          }
          currentLiquidity = LiquidityMath.addDelta(currentLiquidity, liquidityDelta);
        } else if (currentPrice != step.stepSqrtPrice) {
          currentTick = TickMath.getTickAtSqrtRatio(currentPrice); // the price has changed but hasn't reached the target
          break; // since the price hasn't reached the target, amountRequired should be 0
        }
      } while (amountRequired != 0 && currentPrice != limitSqrtPrice); // check stop condition

      int256 amountSpent = cache.amountRequiredInitial - amountRequired; // spent amount could be less than initially specified (e.g. reached limit)
      (amount0, amount1) = zeroToOne == cache.exactInput ? (amountSpent, cache.amountCalculated) : (cache.amountCalculated, amountSpent);
    }

    (globalState.price, globalState.tick) = (currentPrice, currentTick);

    if (cache.crossedAnyTick) {
      (liquidity, prevTickGlobal, nextTickGlobal) = (currentLiquidity, cache.prevInitializedTick, cache.nextInitializedTick);
    }
    if (cache.feeTokenIsZero) {
      totalFeeGrowth0Token = cache.totalFeeGrowthFeeToken;
    } else {
      totalFeeGrowth1Token = cache.totalFeeGrowthFeeToken;
    }
  }
}
