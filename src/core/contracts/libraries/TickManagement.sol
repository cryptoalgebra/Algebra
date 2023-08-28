// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '../interfaces/pool/IAlgebraPoolErrors.sol';

import './TickMath.sol';
import './LiquidityMath.sol';
import './Constants.sol';

/// @title Library for managing and interacting with ticks
/// @notice Contains functions for managing tick processes and relevant calculations
/// @dev Ticks are organized as a doubly linked list
library TickManagement {
  // info stored for each initialized individual tick
  struct Tick {
    uint256 liquidityTotal; // the total position liquidity that references this tick
    int128 liquidityDelta; // amount of net liquidity added (subtracted) when tick is crossed left-right (right-left),
    int24 prevTick;
    int24 nextTick;
    // fee growth per unit of liquidity on the _other_ side of this tick (relative to the current tick)
    // only has relative meaning, not absolute — the value depends on when the tick is initialized
    uint256 outerFeeGrowth0Token;
    uint256 outerFeeGrowth1Token;
  }

  function checkTickRangeValidity(int24 bottomTick, int24 topTick) internal pure {
    if (topTick > TickMath.MAX_TICK) revert IAlgebraPoolErrors.topTickAboveMAX();
    if (topTick <= bottomTick) revert IAlgebraPoolErrors.topTickLowerOrEqBottomTick();
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
  /// @param upper True for updating a position's upper tick, or false for updating a position's lower tick
  /// @return flipped Whether the tick was flipped from initialized to uninitialized, or vice versa
  function update(
    mapping(int24 => Tick) storage self,
    int24 tick,
    int24 currentTick,
    int128 liquidityDelta,
    uint256 totalFeeGrowth0Token,
    uint256 totalFeeGrowth1Token,
    bool upper
  ) internal returns (bool flipped) {
    Tick storage data = self[tick];

    uint256 liquidityTotalBefore = data.liquidityTotal;
    uint256 liquidityTotalAfter = LiquidityMath.addDelta(uint128(liquidityTotalBefore), liquidityDelta);
    if (liquidityTotalAfter > Constants.MAX_LIQUIDITY_PER_TICK) revert IAlgebraPoolErrors.liquidityOverflow();

    int128 liquidityDeltaBefore = data.liquidityDelta;
    // when the lower (upper) tick is crossed left to right (right to left), liquidity must be added (removed)
    data.liquidityDelta = upper ? int128(int256(liquidityDeltaBefore) - liquidityDelta) : int128(int256(liquidityDeltaBefore) + liquidityDelta);
    data.liquidityTotal = liquidityTotalAfter;

    flipped = (liquidityTotalAfter == 0);
    if (liquidityTotalBefore == 0) {
      flipped = !flipped;
      // by convention, we assume that all growth before a tick was initialized happened _below_ the tick
      if (tick <= currentTick) (data.outerFeeGrowth0Token, data.outerFeeGrowth1Token) = (totalFeeGrowth0Token, totalFeeGrowth1Token);
    }
  }

  /// @notice Transitions to next tick as needed by price movement
  /// @param self The mapping containing all tick information for initialized ticks
  /// @param tick The destination tick of the transition
  /// @param feeGrowth0 The all-time global fee growth, per unit of liquidity, in token0
  /// @param feeGrowth1 The all-time global fee growth, per unit of liquidity, in token1
  /// @return liquidityDelta The amount of liquidity added (subtracted) when tick is crossed from left to right (right to left)
  /// @return prevTick The previous active tick before _tick_
  /// @return nextTick The next active tick after _tick_
  function cross(
    mapping(int24 => Tick) storage self,
    int24 tick,
    uint256 feeGrowth0,
    uint256 feeGrowth1
  ) internal returns (int128 liquidityDelta, int24 prevTick, int24 nextTick) {
    Tick storage data = self[tick];
    unchecked {
      (data.outerFeeGrowth1Token, data.outerFeeGrowth0Token) = (feeGrowth1 - data.outerFeeGrowth1Token, feeGrowth0 - data.outerFeeGrowth0Token);
    }
    return (data.liquidityDelta, data.prevTick, data.nextTick);
  }

  /// @notice Used for initial setup of ticks list
  /// @param self The mapping containing all tick information for initialized ticks
  function initTickState(mapping(int24 => Tick) storage self) internal {
    (self[TickMath.MIN_TICK].prevTick, self[TickMath.MIN_TICK].nextTick) = (TickMath.MIN_TICK, TickMath.MAX_TICK);
    (self[TickMath.MAX_TICK].prevTick, self[TickMath.MAX_TICK].nextTick) = (TickMath.MIN_TICK, TickMath.MAX_TICK);
  }

  /// @notice Removes tick from the linked list
  /// @param self The mapping containing all tick information for initialized ticks
  /// @param tick The tick that will be removed
  /// @return prevTick The previous active tick before _tick_
  /// @return nextTick The next active tick after _tick_
  function removeTick(mapping(int24 => Tick) storage self, int24 tick) internal returns (int24 prevTick, int24 nextTick) {
    (prevTick, nextTick) = (self[tick].prevTick, self[tick].nextTick);
    delete self[tick];

    if (tick == TickMath.MIN_TICK || tick == TickMath.MAX_TICK) {
      // MIN_TICK and MAX_TICK cannot be removed from tick list
      (self[tick].prevTick, self[tick].nextTick) = (prevTick, nextTick);
    } else {
      if (prevTick == nextTick) revert IAlgebraPoolErrors.tickIsNotInitialized();
      self[prevTick].nextTick = nextTick;
      self[nextTick].prevTick = prevTick;
    }
    return (prevTick, nextTick);
  }

  /// @notice Adds tick to the linked list
  /// @param self The mapping containing all tick information for initialized ticks
  /// @param tick The tick that will be inserted
  /// @param prevTick The previous active tick before _tick_
  /// @param nextTick The next active tick after _tick_
  function insertTick(mapping(int24 => Tick) storage self, int24 tick, int24 prevTick, int24 nextTick) internal {
    if (tick == TickMath.MIN_TICK || tick == TickMath.MAX_TICK) return;
    if (!(prevTick < tick && nextTick > tick)) revert IAlgebraPoolErrors.tickInvalidLinks();
    (self[tick].prevTick, self[tick].nextTick) = (prevTick, nextTick);

    self[prevTick].nextTick = tick;
    self[nextTick].prevTick = tick;
  }
}
