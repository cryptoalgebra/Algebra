// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import '../libraries/LimitOrderManagement.sol';
import '../libraries/LowGasSafeMath.sol';
import '../libraries/TickMath.sol';
import '../libraries/SafeCast.sol';
import './Positions.sol';

/// @title Algebra limit order positions abstract contract
/// @notice Contains the logic of recalculation and change of limit order positions
/// @dev For limit orders positions, the same structure is used as for liquidity positions. However, it is interpreted differently
abstract contract LimitOrderPositions is Positions {
  using LimitOrderManagement for mapping(int24 => LimitOrderManagement.LimitOrder);
  using LowGasSafeMath for uint128;
  using SafeCast for int256;
  using SafeCast for uint256;

  /**
   * @dev Updates limit order position inner data and applies `amountToSellDelta`
   * @param position The position object to operate with
   * @param tick The tick which price corresponds to the limit order
   * @param amountToSellDelta The amount of token to be added to the sale or subtracted (in case of cancellation)
   * @return amount0 The abs amount of token0 that corresponds to amountToSellDelta
   * @return amount1 The abs amount of token1 that corresponds to amountToSellDelta
   */
  function _updateLimitOrderPosition(
    Position storage position,
    int24 tick,
    int128 amountToSellDelta
  ) internal returns (uint256 amount0, uint256 amount1) {
    _recalculateLimitOrderPosition(position, tick, amountToSellDelta);

    if (amountToSellDelta != 0) {
      bool remove = amountToSellDelta < 0;
      (int24 currentTick, int24 prevTick) = (globalState.tick, globalState.prevInitializedTick);

      if (limitOrders.addOrRemoveLimitOrder(tick, currentTick, amountToSellDelta)) {
        // if tick flipped
        TickManagement.Tick storage _tickData = ticks[tick];
        _tickData.hasLimitOrders = !remove;
        if (_tickData.nextTick == _tickData.prevTick) {
          // tick isn't initialized
          int24 newPrevTick = _insertOrRemoveTick(tick, currentTick, prevTick, remove);
          if (newPrevTick != prevTick) globalState.prevInitializedTick = newPrevTick;
        }
      }

      if (remove) {
        unchecked {
          return (tick > currentTick) ? (uint256(int256(-amountToSellDelta)), uint256(0)) : (uint256(0), uint256(int256(-amountToSellDelta)));
        }
      }
    }
  }

  /**
   * @dev Recalculates how many of the desired amount of tokens have been sold
   * @param position The position object to operate with
   * @param tick The tick which price corresponds to the limit order
   * @param amountToSellDelta The amount of token to be added to the sale or subtracted (in case of cancellation)
   */
  function _recalculateLimitOrderPosition(Position storage position, int24 tick, int128 amountToSellDelta) private {
    uint256 amountToSell;
    uint256 amountToSellInitial;
    unchecked {
      (amountToSell, amountToSellInitial) = (position.liquidity >> 128, uint128(position.liquidity)); // unpack data
    }
    if (amountToSell == 0 && amountToSellDelta == 0) return;

    LimitOrderManagement.LimitOrder storage _limitOrder = limitOrders[tick];
    unchecked {
      uint256 _cumulativeDelta;
      bool zeroToOne;
      {
        uint256 _bought1Cumulative;
        if (!_limitOrder.initialized) {
          // maker pays for storage slots
          (_limitOrder.boughtAmount0Cumulative, _limitOrder.boughtAmount1Cumulative, _limitOrder.initialized) = (1, 1, true);
          _bought1Cumulative = 1;
        } else {
          _bought1Cumulative = _limitOrder.boughtAmount1Cumulative;
        }
        if (amountToSell == 0) {
          // during initialization, "1" is written to the limit order accumulators (boughtAmount{0,1}Cumulative), not zero
          // however, in the future, the accumulators may overflow and become equal to zero
          if (position.innerFeeGrowth0Token == 0) position.innerFeeGrowth0Token = _limitOrder.boughtAmount0Cumulative;
          if (position.innerFeeGrowth1Token == 0) position.innerFeeGrowth1Token = _limitOrder.boughtAmount1Cumulative;
        }
        _cumulativeDelta = _bought1Cumulative - position.innerFeeGrowth1Token;
        zeroToOne = _cumulativeDelta > 0;
        if (!zeroToOne) _cumulativeDelta = _limitOrder.boughtAmount0Cumulative - position.innerFeeGrowth0Token;
      }

      if (_cumulativeDelta > 0) {
        uint256 boughtAmount;
        if (amountToSellInitial > 0) {
          boughtAmount = FullMath.mulDiv(_cumulativeDelta, amountToSellInitial, Constants.Q128);
          uint256 sqrtPrice = TickMath.getSqrtRatioAtTick(tick);
          // MAX_LIMIT_ORDER_TICK check guarantees that this value does not overflow
          uint256 priceX144 = FullMath.mulDiv(sqrtPrice, sqrtPrice, Constants.Q48);
          (uint256 nominator, uint256 denominator) = zeroToOne ? (priceX144, Constants.Q144) : (Constants.Q144, priceX144);
          uint256 amountToBuy = FullMath.mulDiv(amountToSell, nominator, denominator);

          if (boughtAmount < amountToBuy) {
            amountToSell = FullMath.mulDiv(amountToBuy - boughtAmount, denominator, nominator); // unspent input
          } else {
            boughtAmount = amountToBuy;
            amountToSell = 0;
          }
        }
        // casts aren't checked since boughtAmount must be <= type(uint128).max (we are not supporting tokens with totalSupply > type(uint128).max)
        if (zeroToOne) {
          position.innerFeeGrowth1Token = position.innerFeeGrowth1Token + _cumulativeDelta;
          if (boughtAmount > 0) position.fees1 = position.fees1.add128(uint128(boughtAmount));
        } else {
          position.innerFeeGrowth0Token = position.innerFeeGrowth0Token + _cumulativeDelta;
          if (boughtAmount > 0) position.fees0 = position.fees0.add128(uint128(boughtAmount));
        }
      }
      if (amountToSell == 0) amountToSellInitial = 0; // reset if all amount sold

      if (amountToSellDelta != 0) {
        int128 amountToSellInitialDelta = amountToSellDelta;
        // add/remove liquidity to tick with partly executed limit order
        if (amountToSell != amountToSellInitial && amountToSell != 0) {
          // in case of overflow it will be not possible to add tokens for sell until the limit order is fully closed
          amountToSellInitialDelta = amountToSellDelta < 0
            ? (-FullMath.mulDiv(uint128(-amountToSellDelta), amountToSellInitial, amountToSell).toInt256()).toInt128()
            : FullMath.mulDiv(uint128(amountToSellDelta), amountToSellInitial, amountToSell).toInt256().toInt128();

          limitOrders.addVirtualLiquidity(tick, amountToSellInitialDelta - amountToSellDelta);
        }
        amountToSell = LiquidityMath.addDelta(uint128(amountToSell), amountToSellDelta);
        amountToSellInitial = LiquidityMath.addDelta(uint128(amountToSellInitial), amountToSellInitialDelta);
      }
      if (amountToSell == 0) amountToSellInitial = 0; // reset if all amount cancelled

      assert(amountToSell <= type(uint128).max && amountToSellInitial <= type(uint128).max); // should never fail, just in case
      (position.liquidity) = ((amountToSell << 128) | amountToSellInitial); // tightly pack data
    }
  }
}
