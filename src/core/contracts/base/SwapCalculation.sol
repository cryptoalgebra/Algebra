// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import '../interfaces/IAlgebraVirtualPool.sol';
import '../interfaces/IAlgebraPlugin.sol';
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
    uint160 secondsPerLiquidityCumulative; // The global secondPerLiquidity at the moment
    bool crossedAnyTick; //  If we have already crossed at least one active tick
    int256 amountRequiredInitial; // The initial value of the exact input\output amount
    int256 amountCalculated; // The additive amount of total output\input calculated through the swap
    uint256 totalFeeGrowth; // The initial totalFeeGrowth + the fee growth during a swap
    uint256 totalFeeGrowthB;
    bool exactInput; // Whether the exact input or output is specified
    uint16 fee; // The current dynamic fee
    int24 prevInitializedTick; // The previous initialized tick in linked list
    uint32 blockTimestamp; // The timestamp of current block
    uint8 pluginConfig; // TODO
  }

  struct PriceMovementCache {
    uint160 stepSqrtPrice; // The Q64.96 sqrt of the price at the start of the step
    int24 nextTick; // The tick till the current step goes
    bool initialized; // True if the _nextTick_ is initialized
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
      cache.pluginConfig = globalState.pluginConfig;
      if (cache.pluginConfig & Constants.BEFORE_SWAP_HOOK_FLAG != 0) {
        // TODO optimize
        IAlgebraPlugin(plugin).beforeSwap(msg.sender);
      }
      // load from one storage slot
      currentPrice = globalState.price;
      currentTick = globalState.tick;
      cache.fee = globalState.fee;
      cache.communityFee = globalState.communityFee;
      cache.prevInitializedTick = globalState.prevInitializedTick;

      (cache.amountRequiredInitial, cache.exactInput) = (amountRequired, amountRequired > 0);

      currentLiquidity = liquidity;

      if (zeroToOne) {
        if (limitSqrtPrice >= currentPrice || limitSqrtPrice <= TickMath.MIN_SQRT_RATIO) revert invalidLimitSqrtPrice();
        cache.totalFeeGrowth = totalFeeGrowth0Token;
      } else {
        if (limitSqrtPrice <= currentPrice || limitSqrtPrice >= TickMath.MAX_SQRT_RATIO) revert invalidLimitSqrtPrice();
        cache.totalFeeGrowth = totalFeeGrowth1Token;
      }

      cache.blockTimestamp = _blockTimestamp();

      _writeSecondsPerLiquidityCumulative(cache.blockTimestamp, currentLiquidity);
    }

    PriceMovementCache memory step;
    step.nextTick = zeroToOne ? cache.prevInitializedTick : ticks[cache.prevInitializedTick].nextTick;
    unchecked {
      // swap until there is remaining input or output tokens or we reach the price limit
      while (true) {
        step.stepSqrtPrice = currentPrice;
        step.initialized = true; // TODO WHY?
        step.nextTickPrice = TickMath.getSqrtRatioAtTick(step.nextTick);

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

        if (currentPrice == step.nextTickPrice) {
          // if the reached tick is initialized then we need to cross it
          if (step.initialized) {
            if (!cache.crossedAnyTick) {
              cache.crossedAnyTick = true;
              cache.secondsPerLiquidityCumulative = secondsPerLiquidityCumulative;
              cache.totalFeeGrowthB = zeroToOne ? totalFeeGrowth1Token : totalFeeGrowth0Token;
            }

            int128 liquidityDelta;
            if (zeroToOne) {
              liquidityDelta = -ticks.cross(
                step.nextTick,
                cache.totalFeeGrowth, // A == 0
                cache.totalFeeGrowthB, // B == 1
                cache.secondsPerLiquidityCumulative,
                cache.blockTimestamp
              );
              cache.prevInitializedTick = ticks[cache.prevInitializedTick].prevTick;
            } else {
              liquidityDelta = ticks.cross(
                step.nextTick,
                cache.totalFeeGrowthB, // B == 0
                cache.totalFeeGrowth, // A == 1
                cache.secondsPerLiquidityCumulative,
                cache.blockTimestamp
              );
              cache.prevInitializedTick = step.nextTick;
            }
            currentLiquidity = LiquidityMath.addDelta(currentLiquidity, liquidityDelta);
          }

          (currentTick, step.nextTick) = zeroToOne
            ? (step.nextTick - 1, cache.prevInitializedTick)
            : (step.nextTick, ticks[cache.prevInitializedTick].nextTick);
        } else if (currentPrice != step.stepSqrtPrice) {
          // if the price has changed but hasn't reached the target
          currentTick = TickMath.getTickAtSqrtRatio(currentPrice);
          break; // since the price hasn't reached the target, amountRequired should be 0
        }
        // check stop condition
        if (amountRequired == 0 || currentPrice == limitSqrtPrice) {
          break;
        }
      }

      (amount0, amount1) = zeroToOne == cache.exactInput // the amount to provide could be less than initially specified (e.g. reached limit)
        ? (cache.amountRequiredInitial - amountRequired, cache.amountCalculated) // the amount to get could be less than initially specified (e.g. reached limit)
        : (cache.amountCalculated, cache.amountRequiredInitial - amountRequired);
    }

    (globalState.price, globalState.tick, globalState.prevInitializedTick) = (currentPrice, currentTick, cache.prevInitializedTick);

    liquidity = currentLiquidity;
    if (zeroToOne) {
      totalFeeGrowth0Token = cache.totalFeeGrowth;
    } else {
      totalFeeGrowth1Token = cache.totalFeeGrowth;
    }

    // TODO only if crosses ?
    if (cache.pluginConfig & Constants.AFTER_SWAP_HOOK_FLAG != 0) {
      // TODO optimize
      IAlgebraPlugin(plugin).afterSwap(msg.sender);
    }
  }
}
