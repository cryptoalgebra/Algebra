// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import './FullMath.sol';
import './Constants.sol';

/// @title LimitOrderManager
/// @notice Contains functions for managing limit orders and relevant calculations
library LimitOrderManager {
  struct LimitOrder {
    uint128 sumOfAsk;
    uint128 spentAsk;
    uint256 spentAsk0Cumulative;
    uint256 spentAsk1Cumulative;
  }

  /// @notice Updates a limit order state and returns true if the tick was flipped from initialized to uninitialized, or vice versa
  /// @param self The mapping containing limit order cumulatives for initialized ticks
  /// @param tick The tick that will be updated
  /// @param amount The amount of liquidity that will be added/removed
  /// @return flipped Whether the tick was flipped from initialized to uninitialized, or vice versa
  function addOrRemoveLimitOrder(mapping(int24 => LimitOrder) storage self, int24 tick, int128 amount) internal returns (bool flipped) {
    LimitOrder storage data = self[tick];
    uint128 sumOfAskBefore = data.sumOfAsk;
    uint128 sumOfAskAfter = sumOfAskBefore;
    bool add = (amount > 0);

    unchecked {
      if (add) {
        sumOfAskAfter += uint128(amount);
        flipped = sumOfAskBefore == 0;
      } else {
        sumOfAskAfter -= uint128(-amount);
        flipped = sumOfAskAfter == 0;
        if (flipped) data.spentAsk = 0;
      }
      data.sumOfAsk = sumOfAskAfter;
    }
  }

  /// @notice Adds/removes liquidity to tick with partly executed limit order
  /// @param self The mapping containing limit order cumulatives for initialized ticks
  /// @param tick The tick that will be updated
  /// @param amount The amount of liquidity that will be added/removed
  function addVirtualLiquidity(mapping(int24 => LimitOrder) storage self, int24 tick, int128 amount) internal {
    bool add = (amount > 0);
    LimitOrder storage data = self[tick];
    unchecked {
      if (add) {
        data.sumOfAsk += uint128(amount);
        data.spentAsk += uint128(amount);
      } else {
        data.sumOfAsk -= uint128(-amount);
        data.spentAsk -= uint128(-amount);
      }
    }
  }

  /// @notice Executes a limit order on the specified tick
  /// @param self The mapping containing limit order cumulatives for initialized ticks
  /// @param tick Limit order execution tick
  /// @param tickSqrtPrice Limit order execution price
  /// @param zeroToOne The direction of the swap, true for token0 to token1, false for token1 to token0
  /// @param amountRequired Amount of liquidity that will be swapped
  /// @return closed Status of limit order after execution
  /// @return amountOut Amount of token out that user receive after swap
  /// @return amountIn Amount of token in
  function executeLimitOrders(
    mapping(int24 => LimitOrder) storage self,
    int24 tick,
    uint160 tickSqrtPrice,
    bool zeroToOne,
    int256 amountRequired
  ) internal returns (bool closed, uint256 amountOut, uint256 amountIn) {
    unchecked {
      bool exactIn = amountRequired > 0;
      if (!exactIn) amountRequired = -amountRequired;

      uint256 price = FullMath.mulDiv(tickSqrtPrice, tickSqrtPrice, Constants.Q96);
      uint256 amount = (zeroToOne == exactIn)
        ? FullMath.mulDiv(uint256(amountRequired), price, Constants.Q96)
        : FullMath.mulDiv(uint256(amountRequired), Constants.Q96, price);

      (amountOut, amountIn) = exactIn ? (amount, uint256(amountRequired)) : (uint256(amountRequired), amount);

      LimitOrder storage data = self[tick];
      (uint128 sumOfAsk, uint128 spentAsk) = (data.sumOfAsk, data.spentAsk);
      uint256 unspentOutAsk = sumOfAsk - spentAsk;
      if (amountOut >= unspentOutAsk) {
        if (amountOut > unspentOutAsk) {
          amountOut = unspentOutAsk;
          amountIn = zeroToOne ? FullMath.mulDiv(amountOut, Constants.Q96, price) : FullMath.mulDiv(amountOut, price, Constants.Q96);
        }
        closed = true;
        (data.sumOfAsk, data.spentAsk) = (0, 0);
      } else {
        data.spentAsk = spentAsk + uint128(amountOut);
      }

      if (zeroToOne) {
        data.spentAsk0Cumulative += FullMath.mulDivRoundingUp(amountIn, Constants.Q128, sumOfAsk);
      } else {
        data.spentAsk1Cumulative += FullMath.mulDivRoundingUp(amountIn, Constants.Q128, sumOfAsk);
      }
    }
  }
}
