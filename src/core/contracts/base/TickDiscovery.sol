// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import '../libraries/TickManager.sol';
import '../libraries/TickTree.sol';
import './AlgebraPoolBase.sol';

abstract contract TickDiscovery is AlgebraPoolBase {
  using TickManager for mapping(int24 => TickManager.Tick);
  using TickTree for mapping(int16 => uint256);

  constructor() {
    ticks.initTickState();
  }

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
