// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

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

  function addOrRemoveLimitOrder(
    mapping(int24 => LimitOrder) storage self,
    int24 tick,
    int128 amount
  ) internal returns (bool flipped) {
    LimitOrder storage data = self[tick];
    uint128 sumOfAskBefore = data.sumOfAsk;
    uint128 sumOfAskAfter = sumOfAskBefore;
    bool add = (amount > 0);

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

  function executeLimitOrders(
    mapping(int24 => LimitOrder) storage self,
    int24 tick,
    uint160 tickSqrtPrice,
    bool zto,
    int256 amountRequired
  )
    internal
    returns (
      bool closed,
      uint256 amountOut,
      uint256 amountIn
    )
  {
    bool exactIn = amountRequired > 0;
    if (!exactIn) amountRequired = -amountRequired;

    uint256 price = FullMath.mulDiv(tickSqrtPrice, tickSqrtPrice, Constants.Q96);
    uint256 amount = (zto == exactIn)
      ? FullMath.mulDiv(uint256(amountRequired), price, Constants.Q96)
      : FullMath.mulDiv(uint256(amountRequired), Constants.Q96, price);

    (amountOut, amountIn) = exactIn ? (amount, uint256(amountRequired)) : (uint256(amountRequired), amount);

    LimitOrder storage data = self[tick];
    (uint128 sumOfAsk, uint128 spentAsk) = (data.sumOfAsk, data.spentAsk);
    uint256 unspentOutAsk = sumOfAsk - spentAsk;
    if (amountOut >= unspentOutAsk) {
      if (amountOut > unspentOutAsk) {
        amountOut = unspentOutAsk;
        amountIn = zto ? FullMath.mulDiv(amountOut, Constants.Q96, price) : FullMath.mulDiv(amountOut, price, Constants.Q96);
      }
      closed = true;
      (data.sumOfAsk, data.spentAsk) = (0, 0);
    } else {
      data.spentAsk = spentAsk + uint128(amountOut);
    }

    if (zto) {
      data.spentAsk0Cumulative += FullMath.mulDiv(amountIn, Constants.Q128, sumOfAsk);
    } else {
      data.spentAsk1Cumulative += FullMath.mulDiv(amountIn, Constants.Q128, sumOfAsk);
    }
  }
}
