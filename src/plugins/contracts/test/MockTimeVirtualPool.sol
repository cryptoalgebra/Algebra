// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;
pragma abicoder v1;

import '../interfaces/IAlgebraVirtualPool.sol';

contract MockTimeVirtualPool is IAlgebraVirtualPool {
  uint32 public timestamp;
  int24 public currentTick;
  bool private earlyReturn;

  function setEarlyReturn() external {
    earlyReturn = true;
  }

  function crossTo(int24 nextTick, bool) external override returns (bool) {
    if (earlyReturn) return true;

    currentTick = nextTick;
    timestamp = uint32(block.timestamp);

    return true;
  }
}
