// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

import './FullMath.sol';
import './TokenDeltaMath.sol';
import './TickMath.sol';
import './Constants.sol';

/// @title Computes the result of price movement
/// @notice Contains methods for computing the result of price movement within a single tick price range.
library PriceMovementMath {
  using LowGasSafeMath for uint256;
  using SafeCast for uint256;

  /// @notice Gets the next sqrt price given an input amount of token0 or token1
  /// @dev Throws if price or liquidity are 0, or if the next price is out of bounds
  /// @param price The starting Q64.96 sqrt price, i.e., before accounting for the input amount
  /// @param liquidity The amount of usable liquidity
  /// @param input How much of token0, or token1, is being swapped in
  /// @param zeroToOne Whether the amount in is token0 or token1
  /// @return resultPrice The Q64.96 sqrt price after adding the input amount to token0 or token1
  function getNewPriceAfterInput(
    bool zeroToOne,
    uint160 price,
    uint128 liquidity,
    uint256 input
  ) internal pure returns (uint160 resultPrice) {
    return getNewPrice(price, liquidity, input, zeroToOne, true);
  }

  /// @notice Gets the next sqrt price given an output amount of token0 or token1
  /// @dev Throws if price or liquidity are 0 or the next price is out of bounds
  /// @param price The starting Q64.96 sqrt price before accounting for the output amount
  /// @param liquidity The amount of usable liquidity
  /// @param output How much of token0, or token1, is being swapped out
  /// @param zeroToOne Whether the amount out is token0 or token1
  /// @return resultPrice The Q64.96 sqrt price after removing the output amount of token0 or token1
  function getNewPriceAfterOutput(
    bool zeroToOne,
    uint160 price,
    uint128 liquidity,
    uint256 output
  ) internal pure returns (uint160 resultPrice) {
    return getNewPrice(price, liquidity, output, zeroToOne, false);
  }

  function getNewPrice(
    uint160 price,
    uint128 liquidity,
    uint256 amount,
    bool zeroToOne,
    bool fromInput
  ) internal pure returns (uint160 resultPrice) {
    require(price > 0);
    require(liquidity > 0);

    if (zeroToOne == fromInput) {
      // rounding up or down
      if (amount == 0) return price;
      uint256 liquidityShifted = uint256(liquidity) << Constants.RESOLUTION;

      if (fromInput) {
        uint256 product;
        if ((product = amount * price) / amount == price) {
          uint256 denominator = liquidityShifted + product;
          if (denominator >= liquidityShifted) return uint160(FullMath.mulDivRoundingUp(liquidityShifted, price, denominator)); // always fits in 160 bits
        }

        return uint160(FullMath.divRoundingUp(liquidityShifted, (liquidityShifted / price).add(amount)));
      } else {
        uint256 product;
        require((product = amount * price) / amount == price); // if the product overflows, we know the denominator underflows
        require(liquidityShifted > product); // in addition, we must check that the denominator does not underflow
        return FullMath.mulDivRoundingUp(liquidityShifted, price, liquidityShifted - product).toUint160();
      }
    } else {
      // if we're adding (subtracting), rounding down requires rounding the quotient down (up)
      // in both cases, avoid a mulDiv for most inputs
      if (fromInput) {
        return
          uint256(price)
            .add(amount <= type(uint160).max ? (amount << Constants.RESOLUTION) / liquidity : FullMath.mulDiv(amount, Constants.Q96, liquidity))
            .toUint160();
      } else {
        uint256 quotient = amount <= type(uint160).max
          ? FullMath.divRoundingUp(amount << Constants.RESOLUTION, liquidity)
          : FullMath.mulDivRoundingUp(amount, Constants.Q96, liquidity);

        require(price > quotient);
        return uint160(price - quotient); // always fits 160 bits
      }
    }
  }

  function getTokenADelta01(
    uint160 to,
    uint160 from,
    uint128 liquidity
  ) internal pure returns (uint256) {
    return TokenDeltaMath.getToken0Delta(to, from, liquidity, true);
  }

  function getTokenADelta10(
    uint160 to,
    uint160 from,
    uint128 liquidity
  ) internal pure returns (uint256) {
    return TokenDeltaMath.getToken1Delta(from, to, liquidity, true);
  }

  function getTokenBDelta01(
    uint160 to,
    uint160 from,
    uint128 liquidity
  ) internal pure returns (uint256) {
    return TokenDeltaMath.getToken1Delta(to, from, liquidity, false);
  }

  function getTokenBDelta10(
    uint160 to,
    uint160 from,
    uint128 liquidity
  ) internal pure returns (uint256) {
    return TokenDeltaMath.getToken0Delta(from, to, liquidity, false);
  }

  struct ElasticFeeData {
    int32 startTickX100;
    int24 currentTick;
    uint16 fee;
  }

  function calculatePriceImpactFee(
    ElasticFeeData memory feeData,
    uint160 currentPrice,
    uint160 endPrice
  ) internal pure returns (uint256 feeAmount) {
    bool zto = endPrice < currentPrice;

    //return feeData.fee; // TODO TEST

    (int32 currentTickX100, uint160 currentPriceRounded) = TickMath.getTickX100(feeData.currentTick, currentPrice, zto);
    (int32 endTickX100, uint160 endPriceRounded) = TickMath.getTickX100AtSqrtRatio(endPrice, !zto);

    if (currentPriceRounded == endPriceRounded) return feeData.fee / 2;
    int32 startTickX100 = feeData.startTickX100;

    if (zto) {
      if (currentTickX100 > startTickX100) startTickX100 = currentTickX100;
      if (endTickX100 >= startTickX100) return feeData.fee / 2;
    } else {
      if (currentTickX100 < startTickX100) startTickX100 = currentTickX100;
      if (endTickX100 <= startTickX100) return feeData.fee / 2;
    }

    uint256 nominator;
    int256 denominator = (int256(endPriceRounded) - int256(currentPriceRounded)) * int256(Constants.Ln);

    int32 finalTickShift = endTickX100 - startTickX100;
    int32 currentTickShift = currentTickX100 - startTickX100;

    // decrease fee for small swaps
    if (finalTickShift <= Constants.NORMAL_SHIFT && finalTickShift >= -Constants.NORMAL_SHIFT) {
      if (finalTickShift < 0) finalTickShift = -finalTickShift;
      return (uint256(finalTickShift + 500) * feeData.fee) / 1000;
    }

    if (zto) {
      denominator = -denominator;
      nominator = uint256(int256(endPriceRounded) * currentTickShift - int256(currentPriceRounded) * finalTickShift);
    } else {
      nominator = uint256(int256(endPriceRounded) * finalTickShift - int256(currentPriceRounded) * currentTickShift);
    }

    uint256 k;
    if (feeData.fee < 500) {
      k = 75 * feeData.fee + 7500;
    }
    if (feeData.fee < 3000) {
      k = 20 * uint256(feeData.fee) + 40000;
    } else {
      k = (25 * uint256(feeData.fee)) / 3 + 75000;
    }

    feeAmount = FullMath.mulDivRoundingUp(k, nominator - 2 * uint256(denominator), uint256(denominator));

    if (feeAmount > 20000) feeAmount = 20000;
    feeAmount = feeAmount + feeData.fee;
    if (feeAmount > 25000) feeAmount = 25000;
  }

  /// @notice Computes the result of swapping some amount in, or amount out, given the parameters of the swap
  /// @dev The fee, plus the amount in, will never exceed the amount remaining if the swap's `amountSpecified` is positive
  /// @param currentPrice The current Q64.96 sqrt price of the pool
  /// @param targetPrice The Q64.96 sqrt price that cannot be exceeded, from which the direction of the swap is inferred
  /// @param liquidity The usable liquidity
  /// @param amountAvailable How much input or output amount is remaining to be swapped in/out
  /// @return resultPrice The Q64.96 sqrt price after swapping the amount in/out, not to exceed the price target
  /// @return input The amount to be swapped in, of either token0 or token1, based on the direction of the swap
  /// @return output The amount to be received, of either token0 or token1, based on the direction of the swap
  /// @return feeAmount The amount of input that will be taken as a fee
  function movePriceTowardsTarget(
    bool zeroToOne,
    uint160 currentPrice,
    uint160 targetPrice,
    uint128 liquidity,
    int256 amountAvailable,
    ElasticFeeData memory feeData
  )
    internal
    view
    returns (
      uint160 resultPrice,
      uint256 input,
      uint256 output,
      uint256 feeAmount
    )
  {
    function(uint160, uint160, uint128) pure returns (uint256) getAmountA;
    function(uint160, uint160, uint128) pure returns (uint256) getAmountB;
    (getAmountA, getAmountB) = zeroToOne ? (getTokenADelta01, getTokenBDelta01) : (getTokenADelta10, getTokenBDelta10);
    if (amountAvailable >= 0) {
      {
        input = getAmountA(targetPrice, currentPrice, liquidity);
        if (uint256(amountAvailable) > input) {
          uint256 amountAvailableAfterFee;
          {
            uint16 priceImpactFee = uint16(calculatePriceImpactFee(feeData, currentPrice, targetPrice));
            amountAvailableAfterFee = FullMath.mulDiv(uint256(amountAvailable), 1e6 - priceImpactFee, 1e6);
            feeAmount = FullMath.mulDivRoundingUp(input, priceImpactFee, 1e6 - priceImpactFee);
          }
          if (amountAvailableAfterFee >= input) {
            output = getAmountB(targetPrice, currentPrice, liquidity);
            return (targetPrice, input, output, feeAmount);
          }
        }
        feeAmount = feeData.fee; // dirty hack
        for (uint256 i; i < 4; i++) {
          {
            uint256 amountAvailableAfterFee = FullMath.mulDiv(uint256(amountAvailable), 1e6 - feeAmount, 1e6);
            resultPrice = getNewPriceAfterInput(zeroToOne, currentPrice, liquidity, amountAvailableAfterFee);
          }
          uint16 priceImpactFeeNew = uint16(calculatePriceImpactFee(feeData, currentPrice, resultPrice));
          if (feeAmount == priceImpactFeeNew) break;
          feeAmount = priceImpactFeeNew;
        }
        if (targetPrice != resultPrice) {
          input = getAmountA(resultPrice, currentPrice, liquidity);
          // we didn't reach the target, so take the remainder of the maximum input as fee
          feeAmount = uint256(amountAvailable) - input;
        } else {
          feeAmount = FullMath.mulDivRoundingUp(input, feeAmount, 1e6 - feeAmount);
        }
      }
      output = getAmountB(resultPrice, currentPrice, liquidity);
    } else {
      output = getAmountB(targetPrice, currentPrice, liquidity);
      amountAvailable = -amountAvailable;
      if (uint256(amountAvailable) >= output) resultPrice = targetPrice;
      else {
        resultPrice = getNewPriceAfterOutput(zeroToOne, currentPrice, liquidity, uint256(amountAvailable));

        if (targetPrice != resultPrice) {
          output = getAmountB(resultPrice, currentPrice, liquidity);
        }
        // cap the output amount to not exceed the remaining output amount
        if (output > uint256(amountAvailable)) {
          output = uint256(amountAvailable);
        }
      }
      input = getAmountA(resultPrice, currentPrice, liquidity);
      uint16 priceImpactFee = uint16(calculatePriceImpactFee(feeData, currentPrice, resultPrice));
      feeAmount = FullMath.mulDivRoundingUp(input, priceImpactFee, 1e6 - priceImpactFee);
    }
  }
}
