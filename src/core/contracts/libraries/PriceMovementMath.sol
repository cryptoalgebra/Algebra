// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '../interfaces/pool/IAlgebraPoolErrors.sol';
import './FullMath.sol';
import './LowGasSafeMath.sol';
import './TokenDeltaMath.sol';
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
  function getNewPriceAfterInput(uint160 price, uint128 liquidity, uint256 input, bool zeroToOne) internal pure returns (uint160 resultPrice) {
    return getNewPrice(price, liquidity, input, zeroToOne, true);
  }

  /// @notice Gets the next sqrt price given an output amount of token0 or token1
  /// @dev Throws if price or liquidity are 0 or the next price is out of bounds
  /// @param price The starting Q64.96 sqrt price before accounting for the output amount
  /// @param liquidity The amount of usable liquidity
  /// @param output How much of token0, or token1, is being swapped out
  /// @param zeroToOne Whether the amount out is token0 or token1
  /// @return resultPrice The Q64.96 sqrt price after removing the output amount of token0 or token1
  function getNewPriceAfterOutput(uint160 price, uint128 liquidity, uint256 output, bool zeroToOne) internal pure returns (uint160 resultPrice) {
    return getNewPrice(price, liquidity, output, zeroToOne, false);
  }

  function getNewPrice(uint160 price, uint128 liquidity, uint256 amount, bool zeroToOne, bool fromInput) internal pure returns (uint160 resultPrice) {
    unchecked {
      require(price != 0);
      require(liquidity != 0);
      if (amount == 0) return price;

      if (zeroToOne == fromInput) {
        // rounding up or down
        uint256 liquidityShifted = uint256(liquidity) << Constants.RESOLUTION;

        if (fromInput) {
          uint256 product;
          if ((product = amount * price) / amount == price) {
            uint256 denominator = liquidityShifted + product;
            if (denominator >= liquidityShifted) return uint160(FullMath.mulDivRoundingUp(liquidityShifted, price, denominator)); // always fits in 160 bits
          }

          return uint160(FullMath.unsafeDivRoundingUp(liquidityShifted, (liquidityShifted / price).add(amount))); // denominator always > 0
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
            ? FullMath.unsafeDivRoundingUp(amount << Constants.RESOLUTION, liquidity) // denominator always > 0
            : FullMath.mulDivRoundingUp(amount, Constants.Q96, liquidity);

          require(price > quotient);
          return uint160(price - quotient); // always fits 160 bits
        }
      }
    }
  }

  function getInputTokenDelta01(uint160 to, uint160 from, uint128 liquidity) internal pure returns (uint256) {
    return TokenDeltaMath.getToken0Delta(to, from, liquidity, true);
  }

  function getInputTokenDelta10(uint160 to, uint160 from, uint128 liquidity) internal pure returns (uint256) {
    return TokenDeltaMath.getToken1Delta(from, to, liquidity, true);
  }

  function getOutputTokenDelta01(uint160 to, uint160 from, uint128 liquidity) internal pure returns (uint256) {
    return TokenDeltaMath.getToken1Delta(to, from, liquidity, false);
  }

  function getOutputTokenDelta10(uint160 to, uint160 from, uint128 liquidity) internal pure returns (uint256) {
    return TokenDeltaMath.getToken0Delta(from, to, liquidity, false);
  }

  /// @notice Computes the result of swapping some amount in, or amount out, given the parameters of the swap
  /// @dev The fee, plus the amount in, will never exceed the amount remaining if the swap's `amountSpecified` is positive
  /// @param feeOnInput Whether the fee is taken from the input amount
  /// @param zeroToOne The direction of price movement
  /// @param currentPrice The current Q64.96 sqrt price of the pool
  /// @param targetPrice The Q64.96 sqrt price that cannot be exceeded, from which the direction of the swap is inferred
  /// @param liquidity The usable liquidity
  /// @param amountAvailable How much input or output amount is remaining to be swapped in/out
  /// @param fee The fee taken from the input or output amount, expressed in hundredths of a bip
  /// @return resultPrice The Q64.96 sqrt price after swapping the amount in/out, not to exceed the price target
  /// @return input The amount to be swapped in, of either token0 or token1, based on the direction of the swap
  /// @return output The amount to be received, of either token0 or token1, already net of `feeAmount` if not `feeOnInput`
  /// @return feeAmount The amount taken as a fee, in the input token if `feeOnInput`, otherwise in the output token
  function movePriceTowardsTarget(
    bool feeOnInput,
    bool zeroToOne,
    uint160 currentPrice,
    uint160 targetPrice,
    uint128 liquidity,
    int256 amountAvailable,
    uint24 fee
  ) internal pure returns (uint160 resultPrice, uint256 input, uint256 output, uint256 feeAmount) {
    unchecked {
      function(uint160, uint160, uint128) pure returns (uint256) getInputTokenAmount = zeroToOne ? getInputTokenDelta01 : getInputTokenDelta10;

      if (amountAvailable >= 0) {
        // exactIn or not
        if (feeOnInput) {
          uint256 amountAvailableAfterFee = FullMath.mulDiv(uint256(amountAvailable), Constants.FEE_DENOMINATOR - fee, Constants.FEE_DENOMINATOR);
          input = getInputTokenAmount(targetPrice, currentPrice, liquidity);
          if (amountAvailableAfterFee >= input) {
            resultPrice = targetPrice;
            feeAmount = FullMath.mulDivRoundingUp(input, fee, Constants.FEE_DENOMINATOR - fee);
          } else {
            resultPrice = getNewPriceAfterInput(currentPrice, liquidity, amountAvailableAfterFee, zeroToOne);
            assert(targetPrice != resultPrice); // should always be true

            input = getInputTokenAmount(resultPrice, currentPrice, liquidity);
            // we didn't reach the target, so take the remainder of the maximum input as fee
            feeAmount = uint256(amountAvailable) - input; // input <= amountAvailable due to used formulas. This invariant is checked by fuzzy tests
          }

          output = (zeroToOne ? getOutputTokenDelta01 : getOutputTokenDelta10)(resultPrice, currentPrice, liquidity);
        } else {
          (resultPrice, input, output, feeAmount) = _moveExactInWithFeeOnOutput(
            zeroToOne,
            currentPrice,
            targetPrice,
            liquidity,
            uint256(amountAvailable),
            fee
          );
        }
      } else {
        function(uint160, uint160, uint128) pure returns (uint256) getOutputTokenAmount = zeroToOne ? getOutputTokenDelta01 : getOutputTokenDelta10;

        amountAvailable = -amountAvailable;
        if (amountAvailable < 0) revert IAlgebraPoolErrors.invalidAmountRequired(); // in case of type(int256).min

        if (feeOnInput) {
          output = getOutputTokenAmount(targetPrice, currentPrice, liquidity);

          if (uint256(amountAvailable) >= output) resultPrice = targetPrice;
          else {
            resultPrice = getNewPriceAfterOutput(currentPrice, liquidity, uint256(amountAvailable), zeroToOne);

            // should be always true if the price is in the allowed range
            if (targetPrice != resultPrice) output = getOutputTokenAmount(resultPrice, currentPrice, liquidity);

            // cap the output amount to not exceed the remaining output amount
            if (output > uint256(amountAvailable)) output = uint256(amountAvailable);
          }

          input = getInputTokenAmount(resultPrice, currentPrice, liquidity);
          feeAmount = FullMath.mulDivRoundingUp(input, fee, Constants.FEE_DENOMINATOR - fee);
        } else {
          (resultPrice, input, output, feeAmount) = _moveExactOutWithFeeOnOutput(
            zeroToOne,
            currentPrice,
            targetPrice,
            liquidity,
            uint256(amountAvailable),
            fee
          );
        }
      }
    }
  }

  /// @dev The input is not charged, so the whole `amountAvailable` moves the price
  function _moveExactInWithFeeOnOutput(
    bool zeroToOne,
    uint160 currentPrice,
    uint160 targetPrice,
    uint128 liquidity,
    uint256 amountAvailable,
    uint24 fee
  ) private pure returns (uint160 resultPrice, uint256 input, uint256 output, uint256 feeAmount) {
    unchecked {
      input = (zeroToOne ? getInputTokenDelta01 : getInputTokenDelta10)(targetPrice, currentPrice, liquidity);
      if (amountAvailable >= input) {
        resultPrice = targetPrice;
      } else {
        resultPrice = getNewPriceAfterInput(currentPrice, liquidity, amountAvailable, zeroToOne);
        assert(targetPrice != resultPrice); // should always be true

        input = amountAvailable; // no fee to absorb the rounding remainder, so it is left in the reserves
      }

      // the released amount is gross, the fee is carved out of it
      output = (zeroToOne ? getOutputTokenDelta01 : getOutputTokenDelta10)(resultPrice, currentPrice, liquidity);
      feeAmount = FullMath.mulDivRoundingUp(output, fee, Constants.FEE_DENOMINATOR);
      output -= feeAmount;
    }
  }

  /// @dev `amountAvailable` is net, so the pool has to release it grossed up by the fee
  function _moveExactOutWithFeeOnOutput(
    bool zeroToOne,
    uint160 currentPrice,
    uint160 targetPrice,
    uint128 liquidity,
    uint256 amountAvailable,
    uint24 fee
  ) private pure returns (uint160 resultPrice, uint256 input, uint256 output, uint256 feeAmount) {
    unchecked {
      function(uint160, uint160, uint128) pure returns (uint256) getOutputTokenAmount = zeroToOne ? getOutputTokenDelta01 : getOutputTokenDelta10;

      uint256 grossRequired = amountAvailable + FullMath.mulDivRoundingUp(amountAvailable, fee, Constants.FEE_DENOMINATOR - fee);
      output = getOutputTokenAmount(targetPrice, currentPrice, liquidity);

      // must be compared with the grossed up amount, otherwise the price could overshoot the target below
      if (grossRequired >= output) {
        resultPrice = targetPrice;
        feeAmount = FullMath.mulDivRoundingUp(output, fee, Constants.FEE_DENOMINATOR); // gross is known, so a plain share of it
        output -= feeAmount;
      } else {
        resultPrice = getNewPriceAfterOutput(currentPrice, liquidity, grossRequired, zeroToOne);

        // should be always true if the price is in the allowed range
        if (targetPrice != resultPrice) output = getOutputTokenAmount(resultPrice, currentPrice, liquidity);

        // cap the released amount to not exceed the grossed up requirement
        if (output > grossRequired) output = grossRequired;

        // take the remainder over the request as fee: a second rounded share would leave the recipient 1 wei short
        if (output > amountAvailable) {
          feeAmount = output - amountAvailable;
          output = amountAvailable;
        }
      }

      input = (zeroToOne ? getInputTokenDelta01 : getInputTokenDelta10)(resultPrice, currentPrice, liquidity);
    }
  }
}
