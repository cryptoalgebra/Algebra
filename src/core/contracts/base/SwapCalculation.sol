// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '../libraries/PriceMovementMath.sol';
import '../libraries/LowGasSafeMath.sol';
import '../libraries/SafeCast.sol';
import './AlgebraPoolBase.sol';
import './SwapCrossingBuffer.sol';

/// @title Algebra swap calculation abstract contract
/// @notice Contains _calculateSwap encapsulating internal logic of swaps
abstract contract SwapCalculation is AlgebraPoolBase, SwapCrossingBuffer {
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
    uint24 fee; // The current fee value in hundredths of a bip, i.e. 1e-6
    int24 prevInitializedTick; // The previous initialized tick in linked list
    int24 nextInitializedTick; // The next initialized tick in linked list
    uint24 pluginFee;
  }

  struct PriceMovementCache {
    uint256 stepSqrtPrice; // The Q64.96 sqrt of the price at the start of the step, uint256 to minimize casts
    uint256 nextTickPrice; // The Q64.96 sqrt of the price calculated from the _nextTick_, uint256 to minimize casts
    uint256 input; // The additive amount of tokens that have been provided
    uint256 output; // The additive amount of token that have been withdrawn
    uint256 feeAmount; // The total amount of fee earned within a current step
  }

  struct FeesAmount {
    uint256 communityFeeAmount;
    uint256 pluginFeeAmount;
  }

  /// @notice Full result of a swap simulation, including all state changes and tick crossings
  struct SimulationResult {
    int256 amount0;
    int256 amount1;
    uint160 currentPrice;
    int24 currentTick;
    uint128 currentLiquidity;
    bool crossedAnyTick;
    bool exactInput;
    int24 prevInitializedTick;
    int24 nextInitializedTick;
    uint256 totalFeeGrowthInput;
    uint256 feeGrowthOutput; // loaded upfront; same value applies to every crossing
    uint256 communityFee;
    int256 amountRequiredInitial;
    int256 amountCalculated;
    FeesAmount fees;
    uint256 crossingsBuffer;
    uint256 crossingsCount;
  }

  /// @dev Simulates a swap and stores tick crossings in a memory buffer so the caller can
  /// replay them with ticks.cross() to update outerFeeGrowth accumulators.
  /// @param fee     Effective total fee (hundredths of a bip). Must already include pluginFee.
  /// @param pluginFee  Plugin's portion of fee, used only for fee splitting; pass 0 for view quotes.
  /// @param zeroToOne  Swap direction: true = token0 → token1
  /// @param amountRequired  Positive = exact input, negative = exact output
  /// @param limitSqrtPrice  Sqrt price at which the swap must stop
  function _simulateSwap(
    uint24 fee,
    uint24 pluginFee,
    bool zeroToOne,
    int256 amountRequired,
    uint160 limitSqrtPrice,
    bool recordCrossings
  ) private view returns (SimulationResult memory result) {
    if (amountRequired == 0) revert zeroAmountRequired();
    if (amountRequired == type(int256).min) revert invalidAmountRequired();

    (result.currentLiquidity, result.prevInitializedTick, result.nextInitializedTick) = (liquidity, prevTickGlobal, nextTickGlobal);
    (result.currentPrice, result.currentTick, result.communityFee) = (globalState.price, globalState.tick, globalState.communityFee);
    if (result.currentPrice == 0) revert notInitialized();

    // Load feeGrowthOutput upfront (same for the entire swap regardless of how many ticks are crossed)
    if (zeroToOne) {
      if (limitSqrtPrice >= result.currentPrice || limitSqrtPrice <= TickMath.MIN_SQRT_RATIO) revert invalidLimitSqrtPrice();
      result.totalFeeGrowthInput = totalFeeGrowth0Token;
      result.feeGrowthOutput = totalFeeGrowth1Token;
    } else {
      if (limitSqrtPrice <= result.currentPrice || limitSqrtPrice >= TickMath.MAX_SQRT_RATIO) revert invalidLimitSqrtPrice();
      result.totalFeeGrowthInput = totalFeeGrowth1Token;
      result.feeGrowthOutput = totalFeeGrowth0Token;
    }

    result.exactInput = amountRequired > 0;
    result.amountRequiredInitial = amountRequired;

    PriceMovementCache memory step;
    if (recordCrossings) result.crossingsBuffer = _allocateCrossingBuffer();
    unchecked {
      do {
        int24 nextTick = zeroToOne ? result.prevInitializedTick : result.nextInitializedTick;
        step.stepSqrtPrice = result.currentPrice;
        step.nextTickPrice = TickMath.getSqrtRatioAtTick(nextTick);

        (result.currentPrice, step.input, step.output, step.feeAmount) = PriceMovementMath.movePriceTowardsTarget(
          zeroToOne,
          result.currentPrice,
          (zeroToOne == (step.nextTickPrice < limitSqrtPrice)) ? limitSqrtPrice : uint160(step.nextTickPrice),
          result.currentLiquidity,
          amountRequired,
          fee
        );

        if (result.exactInput) {
          amountRequired -= (step.input + step.feeAmount).toInt256();
          result.amountCalculated = result.amountCalculated.sub(step.output.toInt256());
        } else {
          amountRequired += step.output.toInt256();
          result.amountCalculated = result.amountCalculated.add((step.input + step.feeAmount).toInt256());
        }

        if (result.communityFee > 0) {
          uint256 delta = (step.feeAmount.mul(result.communityFee)) / Constants.COMMUNITY_FEE_DENOMINATOR;
          step.feeAmount -= delta;
          result.fees.communityFeeAmount += delta;
        }

        if (pluginFee > 0 && fee > 0) {
          uint256 delta = FullMath.mulDiv(step.feeAmount, pluginFee, fee);
          step.feeAmount -= delta;
          result.fees.pluginFeeAmount += delta;
        }

        if (result.currentLiquidity > 0) result.totalFeeGrowthInput += FullMath.mulDiv(step.feeAmount, Constants.Q128, result.currentLiquidity);

        if (result.currentPrice == step.nextTickPrice) {
          // Record crossing so _calculateSwap can replay ticks.cross() for outerFeeGrowth
          if (recordCrossings) _appendCrossing(result.crossingsBuffer, result.crossingsCount, nextTick, result.totalFeeGrowthInput);
          result.crossingsCount++;
          result.crossedAnyTick = true;

          // Read tick data without writing outerFeeGrowth
          int128 liquidityDelta;
          if (zeroToOne) {
            (liquidityDelta, result.prevInitializedTick, ) = ticks.crossView(nextTick);
            liquidityDelta = -liquidityDelta;
            (result.currentTick, result.nextInitializedTick) = (nextTick - 1, nextTick);
          } else {
            (liquidityDelta, , result.nextInitializedTick) = ticks.crossView(nextTick);
            (result.currentTick, result.prevInitializedTick) = (nextTick, nextTick);
          }
          result.currentLiquidity = LiquidityMath.addDelta(result.currentLiquidity, liquidityDelta);
        } else if (result.currentPrice != step.stepSqrtPrice) {
          result.currentTick = TickMath.getTickAtSqrtRatio(result.currentPrice);
          break;
        }
      } while (amountRequired != 0 && result.currentPrice != limitSqrtPrice);

      int256 amountSpent = result.amountRequiredInitial - amountRequired;
      (result.amount0, result.amount1) = zeroToOne == result.exactInput
        ? (amountSpent, result.amountCalculated)
        : (result.amountCalculated, amountSpent);
    }
  }

  function _calculateSwap(
    uint24 overrideFee,
    uint24 pluginFee,
    bool zeroToOne,
    int256 amountRequired,
    uint160 limitSqrtPrice
  ) internal returns (int256 amount0, int256 amount1, uint160 currentPrice, int24 currentTick, uint128 currentLiquidity, FeesAmount memory fees) {
    uint24 fee = globalState.lastFee;
    if (overrideFee != 0) {
      fee = overrideFee + pluginFee;
      if (fee >= 1e6) revert incorrectPluginFee();
    } else if (pluginFee != 0) {
      fee += pluginFee;
      if (fee >= 1e6) revert incorrectPluginFee();
    }

    SimulationResult memory result = _simulateSwap(fee, pluginFee, zeroToOne, amountRequired, limitSqrtPrice, true);

    // Replay tick crossings to update outerFeeGrowth accumulators in storage.
    // feeGrowthInput captured per-crossing; feeGrowthOutput is constant for the whole swap.
    unchecked {
      for (uint256 i = 0; i < result.crossingsCount; i++) {
        (int24 crossingTick, uint256 crossingFeeGrowthInput) = _loadCrossing(result.crossingsBuffer, i);
        if (zeroToOne) {
          ticks.cross(crossingTick, crossingFeeGrowthInput, result.feeGrowthOutput);
        } else {
          ticks.cross(crossingTick, result.feeGrowthOutput, crossingFeeGrowthInput);
        }
      }
    }

    (globalState.price, globalState.tick) = (result.currentPrice, result.currentTick);
    if (result.crossedAnyTick) {
      (liquidity, prevTickGlobal, nextTickGlobal) = (result.currentLiquidity, result.prevInitializedTick, result.nextInitializedTick);
    }
    if (zeroToOne) {
      totalFeeGrowth0Token = result.totalFeeGrowthInput;
    } else {
      totalFeeGrowth1Token = result.totalFeeGrowthInput;
    }

    return (result.amount0, result.amount1, result.currentPrice, result.currentTick, result.currentLiquidity, result.fees);
  }

  /// @notice View-only swap simulation. Calls _simulateSwap with pluginFee=0 (no fee splitting).
  /// @param fee The fee override in hundredths of a bip (1e-6). Pass 0 to use the pool's lastFee.
  function _calculateSwapView(
    uint24 fee,
    bool zeroToOne,
    int256 amountRequired,
    uint160 limitSqrtPrice
  )
    internal
    view
    returns (int256 amount0, int256 amount1, uint160 currentPrice, int24 currentTick, uint128 currentLiquidity, FeesAmount memory fees)
  {
    if (fee == 0) fee = globalState.lastFee;
    SimulationResult memory result = _simulateSwap(fee, 0, zeroToOne, amountRequired, limitSqrtPrice, false);
    return (result.amount0, result.amount1, result.currentPrice, result.currentTick, result.currentLiquidity, result.fees);
  }
}
