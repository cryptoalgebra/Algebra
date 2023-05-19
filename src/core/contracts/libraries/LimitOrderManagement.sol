// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import '../interfaces/IAlgebraPoolErrors.sol';
import './FullMath.sol';
import './LiquidityMath.sol';
import './Constants.sol';
import './TickMath.sol';

/// @title LimitOrderManagement
/// @notice Contains functions for managing limit orders and relevant calculations
library LimitOrderManagement {
  struct LimitOrder {
    uint128 amountToSell;
    uint128 soldAmount;
    uint256 boughtAmount0Cumulative;
    uint256 boughtAmount1Cumulative;
    bool initialized;
  }

  /// @notice Updates a limit order state and returns true if the tick was flipped from initialized to uninitialized, or vice versa
  /// @param self The mapping containing limit order cumulatives for initialized ticks
  /// @param tick The tick that will be updated
  /// @param currentTick The current tick in pool
  /// @param amount The amount of liquidity that will be added/removed
  /// @return flipped Whether the tick was flipped from initialized to uninitialized, or vice versa
  function addOrRemoveLimitOrder(
    mapping(int24 => LimitOrder) storage self,
    int24 tick,
    int24 currentTick,
    int128 amount
  ) internal returns (bool flipped) {
    if (tick >= Constants.MAX_LIMIT_ORDER_TICK || tick < -Constants.MAX_LIMIT_ORDER_TICK) revert IAlgebraPoolErrors.invalidTickForLimitOrder();

    LimitOrder storage data = self[tick];
    uint128 _amountToSell = data.amountToSell;

    unchecked {
      flipped = _amountToSell == 0; // calculate 'flipped' for amount > 0 case
      _amountToSell = LiquidityMath.addDelta(_amountToSell, amount);
      if (amount > 0) {
        // check if a limit order can be closed at all
        uint256 tickSqrtPrice = TickMath.getSqrtRatioAtTick(tick);
        // MAX_LIMIT_ORDER_TICK check guarantees that this value does not overflow
        uint256 priceX144 = FullMath.mulDiv(tickSqrtPrice, tickSqrtPrice, Constants.Q48);
        uint256 amountToBuy = (tick > currentTick)
          ? FullMath.mulDivRoundingUp(_amountToSell, priceX144, Constants.Q144)
          : FullMath.mulDivRoundingUp(_amountToSell, Constants.Q144, priceX144);
        if (amountToBuy > Constants.Q128 >> 1) revert IAlgebraPoolErrors.invalidAmountForLimitOrder();
      } else {
        flipped = _amountToSell == 0; // override 'flipped' value
        if (flipped) data.soldAmount = 0; // reset filled amount if all orders are closed
      }
      data.amountToSell = _amountToSell;
    }
  }

  /// @notice Adds/removes liquidity to tick with partly executed limit order
  /// @param self The mapping containing limit order cumulatives for initialized ticks
  /// @param tick The tick that will be updated
  /// @param amount The amount of liquidity that will be added/removed
  function addVirtualLiquidity(mapping(int24 => LimitOrder) storage self, int24 tick, int128 amount) internal {
    LimitOrder storage data = self[tick];
    if (amount > 0) {
      data.amountToSell += uint128(amount);
      data.soldAmount += uint128(amount);
    } else {
      data.amountToSell -= uint128(-amount);
      data.soldAmount -= uint128(-amount);
    }
  }

  /// @notice Executes a limit order on the specified tick
  /// @param self The mapping containing limit order cumulatives for initialized ticks
  /// @param tick Limit order execution tick
  /// @param tickSqrtPrice Limit order execution price
  /// @param zeroToOne The direction of the swap, true for token0 to token1, false for token1 to token0
  /// @param amountA Amount of tokens that will be swapped
  /// @param fee The fee taken from the input amount, expressed in hundredths of a bip
  /// @return closed Status of limit order after execution
  /// @return amountOut Amount of token that user receive after swap
  /// @return amountIn Amount of token that user need to pay
  function executeLimitOrders(
    mapping(int24 => LimitOrder) storage self,
    int24 tick,
    uint160 tickSqrtPrice,
    bool zeroToOne,
    int256 amountA,
    uint16 fee
  ) internal returns (bool closed, uint256 amountOut, uint256 amountIn, uint256 feeAmount) {
    unchecked {
      bool exactIn = amountA > 0;
      if (!exactIn) amountA = -amountA;
      if (amountA < 0) revert IAlgebraPoolErrors.invalidAmountRequired(); // in case of type(int256).min

      // price is defined as "token1/token0"
      // MAX_LIMIT_ORDER_TICK check guarantees that this value does not overflow
      uint256 priceX144 = FullMath.mulDiv(tickSqrtPrice, tickSqrtPrice, Constants.Q48);

      uint256 amountB = (zeroToOne == exactIn)
        ? FullMath.mulDiv(uint256(amountA), priceX144, Constants.Q144) // tokenA is token0
        : FullMath.mulDiv(uint256(amountA), Constants.Q144, priceX144); // tokenA is token1

      // limit orders buy tokenIn and sell tokenOut
      (amountOut, amountIn) = exactIn ? (amountB, uint256(amountA)) : (uint256(amountA), amountB);

      LimitOrder storage data = self[tick];
      (uint128 amountToSell, uint128 soldAmount) = (data.amountToSell, data.soldAmount);
      uint256 unsoldAmount = amountToSell - soldAmount; // safe since soldAmount always < amountToSell

      if (exactIn) {
        amountOut = FullMath.mulDiv(amountOut, Constants.FEE_DENOMINATOR - fee, Constants.FEE_DENOMINATOR);
      }

      if (amountOut >= unsoldAmount) {
        if (amountOut > unsoldAmount) {
          amountOut = unsoldAmount;
        }
        (closed, data.amountToSell, data.soldAmount) = (true, 0, 0);
      } else {
        // overflow is desired since we do not support tokens with totalSupply > type(uint128).max
        data.soldAmount = soldAmount + uint128(amountOut);
      }

      amountIn = zeroToOne
        ? FullMath.mulDivRoundingUp(amountOut, Constants.Q144, priceX144)
        : FullMath.mulDivRoundingUp(amountOut, priceX144, Constants.Q144);

      if (exactIn) {
        if (amountOut == unsoldAmount) {
          feeAmount = FullMath.mulDivRoundingUp(amountIn, fee, Constants.FEE_DENOMINATOR);
        } else {
          feeAmount = uint256(amountA) - amountIn;
        }
      } else {
        feeAmount = FullMath.mulDivRoundingUp(amountIn, fee, Constants.FEE_DENOMINATOR - fee);
      }

      // overflows are desired since there are relative accumulators
      if (zeroToOne) {
        data.boughtAmount0Cumulative += FullMath.mulDiv(amountIn, Constants.Q128, amountToSell);
      } else {
        data.boughtAmount1Cumulative += FullMath.mulDiv(amountIn, Constants.Q128, amountToSell);
      }
    }
  }
}
