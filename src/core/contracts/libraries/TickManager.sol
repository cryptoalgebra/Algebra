// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

import './LowGasSafeMath.sol';
import './SafeCast.sol';

import './TickMath.sol';
import './FullMath.sol';
import './LiquidityMath.sol';
import './Constants.sol';

/// @title TickManager
/// @notice Contains functions for managing tick processes and relevant calculations
library TickManager {
  using LowGasSafeMath for int256;
  using SafeCast for int256;

  // info stored for each initialized individual tick
  struct Tick {
    uint128 liquidityTotal; // the total position liquidity that references this tick
    int128 liquidityDelta; // amount of net liquidity added (subtracted) when tick is crossed left-right (right-left),
    // fee growth per unit of liquidity on the _other_ side of this tick (relative to the current tick)
    // only has relative meaning, not absolute — the value depends on when the tick is initialized
    uint256 outerFeeGrowth0Token;
    uint256 outerFeeGrowth1Token;
    int24 prevTick;
    int24 nextTick;
    bool initialized; // these 8 bits are set to prevent fresh sstores when crossing newly initialized ticks
    uint128 sumOfAsk;
    uint128 spentAsk;
    uint256 spentAsk0Cumulative;
    uint256 spentAsk1Cumulative;
  }

  function checkTickRangeValidity(int24 bottomTick, int24 topTick) internal pure {
    require(topTick < TickMath.MAX_TICK + 1, 'TUM');
    require(topTick >= bottomTick, 'TLU');
    require(bottomTick > TickMath.MIN_TICK - 1, 'TLM');
  }

  /// @notice Retrieves fee growth data
  /// @param self The mapping containing all tick information for initialized ticks
  /// @param bottomTick The lower tick boundary of the position
  /// @param topTick The upper tick boundary of the position
  /// @param currentTick The current tick
  /// @param totalFeeGrowth0Token The all-time global fee growth, per unit of liquidity, in token0
  /// @param totalFeeGrowth1Token The all-time global fee growth, per unit of liquidity, in token1
  /// @return innerFeeGrowth0Token The all-time fee growth in token0, per unit of liquidity, inside the position's tick boundaries
  /// @return innerFeeGrowth1Token The all-time fee growth in token1, per unit of liquidity, inside the position's tick boundaries
  function getInnerFeeGrowth(
    mapping(int24 => Tick) storage self,
    int24 bottomTick,
    int24 topTick,
    int24 currentTick,
    uint256 totalFeeGrowth0Token,
    uint256 totalFeeGrowth1Token
  ) internal view returns (uint256 innerFeeGrowth0Token, uint256 innerFeeGrowth1Token) {
    Tick storage lower = self[bottomTick];
    Tick storage upper = self[topTick];

    if (currentTick < topTick) {
      if (currentTick >= bottomTick) {
        innerFeeGrowth0Token = totalFeeGrowth0Token - lower.outerFeeGrowth0Token;
        innerFeeGrowth1Token = totalFeeGrowth1Token - lower.outerFeeGrowth1Token;
      } else {
        innerFeeGrowth0Token = lower.outerFeeGrowth0Token;
        innerFeeGrowth1Token = lower.outerFeeGrowth1Token;
      }
      innerFeeGrowth0Token -= upper.outerFeeGrowth0Token;
      innerFeeGrowth1Token -= upper.outerFeeGrowth1Token;
    } else {
      innerFeeGrowth0Token = upper.outerFeeGrowth0Token - lower.outerFeeGrowth0Token;
      innerFeeGrowth1Token = upper.outerFeeGrowth1Token - lower.outerFeeGrowth1Token;
    }
  }

  /// @notice Updates a tick and returns true if the tick was flipped from initialized to uninitialized, or vice versa
  /// @param self The mapping containing all tick information for initialized ticks
  /// @param tick The tick that will be updated
  /// @param currentTick The current tick
  /// @param liquidityDelta A new amount of liquidity to be added (subtracted) when tick is crossed from left to right (right to left)
  /// @param totalFeeGrowth0Token The all-time global fee growth, per unit of liquidity, in token0
  /// @param totalFeeGrowth1Token The all-time global fee growth, per unit of liquidity, in token1
  /// @param secondsPerLiquidityCumulative The all-time seconds per max(1, liquidity) of the pool
  /// @param time The current block timestamp cast to a uint32
  /// @param upper true for updating a position's upper tick, or false for updating a position's lower tick
  /// @return flipped Whether the tick was flipped from initialized to uninitialized, or vice versa
  function update(
    mapping(int24 => Tick) storage self,
    int24 tick,
    int24 currentTick,
    int128 liquidityDelta,
    uint256 totalFeeGrowth0Token,
    uint256 totalFeeGrowth1Token,
    uint160 secondsPerLiquidityCumulative,
    uint32 time,
    bool upper
  ) internal returns (bool flipped) {
    Tick storage data = self[tick];

    int128 liquidityDeltaBefore = data.liquidityDelta;
    uint128 liquidityTotalBefore = data.liquidityTotal;

    uint128 liquidityTotalAfter = LiquidityMath.addDelta(liquidityTotalBefore, liquidityDelta);
    require(liquidityTotalAfter < Constants.MAX_LIQUIDITY_PER_TICK + 1, 'LO');

    // when the lower (upper) tick is crossed left to right (right to left), liquidity must be added (removed)
    data.liquidityDelta = upper
      ? int256(liquidityDeltaBefore).sub(liquidityDelta).toInt128()
      : int256(liquidityDeltaBefore).add(liquidityDelta).toInt128();

    data.liquidityTotal = liquidityTotalAfter;

    flipped = (liquidityTotalAfter == 0);
    if (liquidityTotalBefore == 0) {
      flipped = !flipped;
      // by convention, we assume that all growth before a tick was initialized happened _below_ the tick
      if (tick <= currentTick) {
        data.outerFeeGrowth0Token = totalFeeGrowth0Token;
        data.outerFeeGrowth1Token = totalFeeGrowth1Token;
      }
      data.initialized = true;
    }
  }

  /// @notice Transitions to next tick as needed by price movement
  /// @param self The mapping containing all tick information for initialized ticks
  /// @param tick The destination tick of the transition
  /// @param totalFeeGrowth0Token The all-time global fee growth, per unit of liquidity, in token0
  /// @param totalFeeGrowth1Token The all-time global fee growth, per unit of liquidity, in token1
  /// @return liquidityDelta The amount of liquidity added (subtracted) when tick is crossed from left to right (right to left)
  function cross(
    mapping(int24 => Tick) storage self,
    int24 tick,
    uint256 totalFeeGrowth0Token,
    uint256 totalFeeGrowth1Token
  ) internal returns (int128 liquidityDelta) {
    Tick storage data = self[tick];

    data.outerFeeGrowth1Token = totalFeeGrowth1Token - data.outerFeeGrowth1Token;
    data.outerFeeGrowth0Token = totalFeeGrowth0Token - data.outerFeeGrowth0Token;

    return data.liquidityDelta;
  }

  /// @notice Used for initial setup if ticks list
  /// @param self The mapping containing all tick information for initialized ticks
  function initTickState(mapping(int24 => Tick) storage self) internal {
    (self[TickMath.MIN_TICK].prevTick, self[TickMath.MIN_TICK].nextTick) = (TickMath.MIN_TICK, TickMath.MAX_TICK);
    (self[TickMath.MAX_TICK].prevTick, self[TickMath.MAX_TICK].nextTick) = (TickMath.MIN_TICK, TickMath.MAX_TICK);
  }

  /// @notice Removes tick from linked list
  /// @param self The mapping containing all tick information for initialized ticks
  /// @param tick The tick that will be removed
  function removeTick(mapping(int24 => Tick) storage self, int24 tick) internal {
    if (tick == TickMath.MIN_TICK || tick == TickMath.MAX_TICK) return;
    (int24 prevTick, int24 nextTick) = (self[tick].prevTick, self[tick].nextTick);
    require(prevTick != nextTick, 'next eq prev tick');
    self[prevTick].nextTick = nextTick;
    self[nextTick].prevTick = prevTick;

    Tick storage _tick = self[tick];
    _tick.outerFeeGrowth0Token = 0;
    _tick.outerFeeGrowth1Token = 0;
    (_tick.prevTick, _tick.nextTick, _tick.initialized) = (0, 0, false);
  }

  /// @notice Adds tick to linked list
  /// @param self The mapping containing all tick information for initialized ticks
  /// @param tick The tick that will be inserted
  /// @param prevTick The previous active tick
  /// @param nextTick The next active tick
  function insertTick(
    mapping(int24 => Tick) storage self,
    int24 tick,
    int24 prevTick,
    int24 nextTick
  ) internal {
    if (tick == TickMath.MIN_TICK || tick == TickMath.MAX_TICK) return;
    require(prevTick < tick && nextTick > tick, 'invalid lower value');
    self[tick].prevTick = prevTick;
    self[tick].nextTick = nextTick;
    self[prevTick].nextTick = tick;
    self[nextTick].prevTick = tick;
  }

  function addOrRemoveLimitOrder(
    mapping(int24 => Tick) storage self,
    int24 tick,
    uint128 amount,
    bool add
  ) internal returns (bool flipped) {
    Tick storage data = self[tick];
    uint128 sumOfAsk = data.sumOfAsk;
    sumOfAsk = add ? sumOfAsk + amount : sumOfAsk - amount;
    data.sumOfAsk = sumOfAsk;

    if (add) {
      if (!data.initialized) {
        data.initialized = true;
        flipped = true;
      }
    } else {
      if (sumOfAsk == 0) {
        data.spentAsk = 0; // TODO can be optimized
        flipped = data.liquidityTotal == 0;
      }
    }
  }

  function executeLimitOrders(
    mapping(int24 => Tick) storage self,
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

    Tick storage data = self[tick];
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
        uint256 unspentInputAsk = zto
          ? FullMath.mulDivRoundingUp(unspentAsk, Constants.Q96, price)
          : FullMath.mulDivRoundingUp(unspentAsk, price, Constants.Q96);

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
