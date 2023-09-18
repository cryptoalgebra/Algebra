// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '../libraries/TickManagement.sol';
import '../libraries/TickTree.sol';
import './AlgebraPoolBase.sol';

/// @title Algebra tick structure abstract contract
/// @notice Encapsulates the logic of interaction with the data structure with ticks
/// @dev Ticks are stored as a doubly linked list. A three-level bitmap tree is used to search through the list
abstract contract TickStructure is AlgebraPoolBase {
  using TickManagement for mapping(int24 => TickManagement.Tick);
  using TickTree for mapping(int16 => uint256);

  /// @inheritdoc IAlgebraPoolState
  uint32 public override tickTreeRoot; // The root bitmap of search tree
  /// @inheritdoc IAlgebraPoolState
  mapping(int16 => uint256) public override tickTreeSecondLayer; // The second layer of search tree

  // the leaves of the tree are stored in `tickTable`

  constructor() {
    ticks.initTickState();
  }

  /// @notice Used to add or remove a tick from a doubly linked list and search tree
  /// @param tick The tick being removed or added now
  /// @param currentTick The current global tick in the pool
  /// @param oldTickTreeRoot The current tick tree root
  /// @param prevInitializedTick Previous active tick before `currentTick`
  /// @param nextInitializedTick Next active tick after `currentTick`
  /// @param remove Remove or add the tick
  /// @return New previous active tick before `currentTick` if changed
  /// @return New next active tick after `currentTick` if changed
  /// @return New tick tree root if changed
  function _addOrRemoveTick(
    int24 tick,
    int24 currentTick,
    uint32 oldTickTreeRoot,
    int24 prevInitializedTick,
    int24 nextInitializedTick,
    bool remove
  ) internal returns (int24, int24, uint32) {
    if (remove) {
      (int24 prevTick, int24 nextTick) = ticks.removeTick(tick);
      if (prevInitializedTick == tick) prevInitializedTick = prevTick;
      else if (nextInitializedTick == tick) nextInitializedTick = nextTick;
    } else {
      int24 prevTick;
      int24 nextTick;
      if (prevInitializedTick < tick && nextInitializedTick > tick) {
        (prevTick, nextTick) = (prevInitializedTick, nextInitializedTick); // we know next and prev ticks
        if (tick > currentTick) nextInitializedTick = tick;
        else prevInitializedTick = tick;
      } else {
        nextTick = tickTable.getNextTick(tickTreeSecondLayer, oldTickTreeRoot, tick);
        prevTick = ticks[nextTick].prevTick;
      }
      ticks.insertTick(tick, prevTick, nextTick);
    }

    uint32 newTickTreeRoot = tickTable.toggleTick(tickTreeSecondLayer, oldTickTreeRoot, tick);
    return (prevInitializedTick, nextInitializedTick, newTickTreeRoot);
  }

  /// @notice Used to add or remove a pair of ticks from a doubly linked list and search tree
  /// @param bottomTick The bottom tick being removed or added now
  /// @param topTick The top tick being removed or added now
  /// @param toggleBottom Should bottom tick be changed or not
  /// @param toggleTop Should top tick be changed or not
  /// @param currentTick The current global tick in the pool
  /// @param remove Remove or add the ticks
  function _addOrRemoveTicks(int24 bottomTick, int24 topTick, bool toggleBottom, bool toggleTop, int24 currentTick, bool remove) internal override {
    (int24 prevInitializedTick, int24 nextInitializedTick, uint32 oldTickTreeRoot) = (prevTickGlobal, nextTickGlobal, tickTreeRoot);
    (int24 newPrevTick, int24 newNextTick, uint32 newTreeRoot) = (prevInitializedTick, nextInitializedTick, oldTickTreeRoot);
    if (toggleBottom) {
      (newPrevTick, newNextTick, newTreeRoot) = _addOrRemoveTick(bottomTick, currentTick, newTreeRoot, newPrevTick, newNextTick, remove);
    }
    if (toggleTop) {
      (newPrevTick, newNextTick, newTreeRoot) = _addOrRemoveTick(topTick, currentTick, newTreeRoot, newPrevTick, newNextTick, remove);
    }
    if (prevInitializedTick != newPrevTick || nextInitializedTick != newNextTick || newTreeRoot != oldTickTreeRoot) {
      (prevTickGlobal, nextTickGlobal, tickTreeRoot) = (newPrevTick, newNextTick, newTreeRoot);
    }
  }
}
