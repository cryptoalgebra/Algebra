// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/core/contracts/libraries/TickTree.sol';

import '../libraries/VirtualTickManagement.sol';
import '../interfaces/IAlgebraEternalVirtualPool.sol';

/// @title Algebra tick structure abstract contract
/// @notice Encapsulates the logic of interaction with the data structure with ticks
/// @dev Ticks are stored as a doubly linked list. A two-layer bitmap tree is used to search through the list
abstract contract VirtualTickStructure is IAlgebraEternalVirtualPool {
  using VirtualTickManagement for mapping(int24 => VirtualTickManagement.Tick);
  using TickTree for mapping(int16 => uint256);

  mapping(int24 => VirtualTickManagement.Tick) public ticks;

  uint32 internal tickTreeRoot; // The root of bitmap search tree
  mapping(int16 => uint256) internal tickSecondLayer; // The second layer bitmap search tree
  mapping(int16 => uint256) internal tickTable; // the leaves of the tree

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
  ) internal returns (int24 newPrevInitializedTick) {
    uint32 oldTickTreeRoot = tickTreeRoot;

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

    uint32 newTickTreeRoot = tickTable.toggleTick(tickSecondLayer, oldTickTreeRoot, tick);
    if (newTickTreeRoot != oldTickTreeRoot) tickTreeRoot = newTickTreeRoot;
    return prevInitializedTick;
  }
}
