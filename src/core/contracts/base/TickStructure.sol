// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import '../libraries/TickManagement.sol';
import '../libraries/TickTree.sol';
import './AlgebraPoolBase.sol';

/// @title Algebra tick structure abstract contract
/// @notice Encapsulates the logic of interaction with the data structure with ticks
/// @dev Ticks are stored as a doubly linked list. A two-layer bitmap tree is used to search through the list
abstract contract TickStructure is AlgebraPoolBase {
  using TickManagement for mapping(int24 => TickManagement.Tick);
  using TickTree for mapping(int16 => uint256);

  uint256 internal tickTreeRoot; // The root of bitmap search tree
  mapping(int16 => uint256) internal tickSecondLayer; // The second layer bitmap search tree

  // the leaves of the tree are stored in `tickTable`

  constructor() {
    ticks.initTickState();
  }

  /**
   * @notice Used to add or remove a tick from a doubly linked list and search tree
   * @param tick The tick being removed or added now
   * @param currentTick The current global tick in the pool
   * @param prevInitializedTick Previous active tick before `currentTick`
   * @param remove Remove or add the tick
   * @return newPrevInitializedTick New previous active tick before `currentTick` if changed
   */
  function _insertOrRemoveTick(
    int24 tick,
    int24 currentTick,
    int24 prevInitializedTick,
    bool remove
  ) internal override returns (int24 newPrevInitializedTick) {
    uint256 oldTickTreeRoot = tickTreeRoot;

    int24 prevTick;
    if (remove) {
      prevTick = ticks.removeTick(tick);
      if (prevInitializedTick == tick) prevInitializedTick = prevTick;
    } else {
      int24 nextTick;
      if (prevInitializedTick < tick && tick <= currentTick) {
        nextTick = ticks[prevInitializedTick].nextTick;
        prevTick = prevInitializedTick;
        prevInitializedTick = tick;
      } else {
        nextTick = tickTable.getNextTick(tickSecondLayer, oldTickTreeRoot, tick);
        prevTick = ticks[nextTick].prevTick;
      }
      ticks.insertTick(tick, prevTick, nextTick);
    }

    uint256 newTickTreeRoot = tickTable.toggleTick(tickSecondLayer, tick, oldTickTreeRoot);
    if (newTickTreeRoot != oldTickTreeRoot) tickTreeRoot = newTickTreeRoot;
    return prevInitializedTick;
  }
}
