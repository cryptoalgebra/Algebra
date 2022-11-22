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
    uint128 amount,
    bool add
  ) internal returns (bool flipped) {
    LimitOrder storage data = self[tick];
    uint128 sumOfAskBefore = data.sumOfAsk;
    uint128 sumOfAskAfter = add ? sumOfAskBefore + amount : sumOfAskBefore - amount;
    data.sumOfAsk = sumOfAskAfter;

    if (add) {
      flipped = sumOfAskBefore == 0;
    } else {
      if (sumOfAskAfter == 0) {
        flipped = true;
        data.spentAsk = 0; // TODO can be optimized
      }
    }
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
      uint256 amountRequiredLeft,
      uint256 amount
    )
  {
    bool exactIn = amountRequired > 0;
    if (!exactIn) amountRequired = -amountRequired;

    LimitOrder storage data = self[tick];
    (uint128 sumOfAsk, uint128 spentAsk) = (data.sumOfAsk, data.spentAsk);
    uint256 price = FullMath.mulDiv(tickSqrtPrice, tickSqrtPrice, Constants.Q96);

    amount = (zto == exactIn)
      ? FullMath.mulDiv(uint256(amountRequired), price, Constants.Q96)
      : FullMath.mulDiv(uint256(amountRequired), Constants.Q96, price);

    uint256 unspentAsk = sumOfAsk - spentAsk;
    (uint256 amountOut, uint256 amountIn) = exactIn ? (amount, uint256(amountRequired)) : (uint256(amountRequired), amount);
    if (amountOut >= unspentAsk) {
      (data.sumOfAsk, data.spentAsk) = (0, 0);
      closed = true;
      if (amountOut > unspentAsk) {
        uint256 unspentInputAsk = zto ? FullMath.mulDiv(unspentAsk, Constants.Q96, price) : FullMath.mulDiv(unspentAsk, price, Constants.Q96);

        (amount, amountRequiredLeft) = exactIn
          ? (unspentAsk, uint256(amountRequired) - unspentInputAsk)
          : (unspentInputAsk, uint256(amountRequired) - unspentAsk);
        amountIn = unspentInputAsk;
      }
    } else {
      data.spentAsk += uint128(amountOut);
    }

    if (zto) {
      data.spentAsk0Cumulative += FullMath.mulDiv(amountIn, Constants.Q128, sumOfAsk);
    } else {
      data.spentAsk1Cumulative += FullMath.mulDiv(amountIn, Constants.Q128, sumOfAsk);
    }
  }
}
