// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import '../interfaces/IAlgebraPoolErrors.sol';

import './TickMath.sol';
import './LiquidityMath.sol';
import './Constants.sol';

/// @title TickManagement
/// @notice Contains functions for managing tick processes and relevant calculations
library TickManagement {
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
    uint160 outerSecondsPerLiquidity; // the seconds per unit of liquidity on the _other_ side of current tick, (relative meaning)
    uint32 outerSecondsSpent; // the seconds spent on the other side of the current tick, only has relative meaning
    bool hasLimitOrders;
  }

  function checkTickRangeValidity(int24 bottomTick, int24 topTick) internal pure {
    if (topTick > TickMath.MAX_TICK) revert IAlgebraPoolErrors.topTickAboveMAX();
    if (topTick < bottomTick) revert IAlgebraPoolErrors.topTickLowerThanBottomTick();
    if (bottomTick < TickMath.MIN_TICK) revert IAlgebraPoolErrors.bottomTickLowerThanMIN();
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

    unchecked {
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
    if (liquidityTotalAfter > Constants.MAX_LIQUIDITY_PER_TICK) revert IAlgebraPoolErrors.liquidityOverflow();

    // when the lower (upper) tick is crossed left to right (right to left), liquidity must be added (removed)
    data.liquidityDelta = upper ? int128(int256(liquidityDeltaBefore) - liquidityDelta) : int128(int256(liquidityDeltaBefore) + liquidityDelta);

    data.liquidityTotal = liquidityTotalAfter;

    flipped = (liquidityTotalAfter == 0);
    if (liquidityTotalBefore == 0) {
      flipped = !flipped;
      // by convention, we assume that all growth before a tick was initialized happened _below_ the tick
      if (tick <= currentTick) {
        data.outerFeeGrowth0Token = totalFeeGrowth0Token;
        data.outerFeeGrowth1Token = totalFeeGrowth1Token;
        data.outerSecondsPerLiquidity = secondsPerLiquidityCumulative;
        data.outerSecondsSpent = time;
      }
    }

    if (flipped) flipped = !data.hasLimitOrders;
  }

  /// @notice Transitions to next tick as needed by price movement
  /// @param self The mapping containing all tick information for initialized ticks
  /// @param tick The destination tick of the transition
  /// @param totalFeeGrowth0Token The all-time global fee growth, per unit of liquidity, in token0
  /// @param totalFeeGrowth1Token The all-time global fee growth, per unit of liquidity, in token1
  /// @param secondsPerLiquidityCumulative The current seconds per liquidity
  /// @param time The current block.timestamp
  /// @return liquidityDelta The amount of liquidity added (subtracted) when tick is crossed from left to right (right to left)
  function cross(
    mapping(int24 => Tick) storage self,
    int24 tick,
    uint256 totalFeeGrowth0Token,
    uint256 totalFeeGrowth1Token,
    uint160 secondsPerLiquidityCumulative,
    uint32 time
  ) internal returns (int128 liquidityDelta) {
    Tick storage data = self[tick];

    unchecked {
      data.outerSecondsSpent = time - data.outerSecondsSpent;
      data.outerSecondsPerLiquidity = secondsPerLiquidityCumulative - data.outerSecondsPerLiquidity;

      data.outerFeeGrowth1Token = totalFeeGrowth1Token - data.outerFeeGrowth1Token;
      data.outerFeeGrowth0Token = totalFeeGrowth0Token - data.outerFeeGrowth0Token;
    }
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
  /// @return prevTick
  function removeTick(mapping(int24 => Tick) storage self, int24 tick) internal returns (int24) {
    (int24 prevTick, int24 nextTick) = (self[tick].prevTick, self[tick].nextTick);
    delete self[tick];

    if (tick == TickMath.MIN_TICK || tick == TickMath.MAX_TICK) {
      // MIN_TICK and MAX_TICK cannot be removed from tick list
      (self[tick].prevTick, self[tick].nextTick) = (prevTick, nextTick);
      return prevTick;
    } else {
      if (prevTick == nextTick) revert IAlgebraPoolErrors.tickIsNotInitialized();
      self[prevTick].nextTick = nextTick;
      self[nextTick].prevTick = prevTick;
      return prevTick;
    }
  }

  /// @notice Adds tick to linked list
  /// @param self The mapping containing all tick information for initialized ticks
  /// @param tick The tick that will be inserted
  /// @param prevTick The previous active tick
  /// @param nextTick The next active tick
  function insertTick(mapping(int24 => Tick) storage self, int24 tick, int24 prevTick, int24 nextTick) internal {
    if (tick == TickMath.MIN_TICK || tick == TickMath.MAX_TICK) return;
    if (prevTick >= tick || nextTick <= tick) revert IAlgebraPoolErrors.tickInvalidLinks();
    (self[tick].prevTick, self[tick].nextTick) = (prevTick, nextTick);

    self[prevTick].nextTick = tick;
    self[nextTick].prevTick = tick;
  }
}
