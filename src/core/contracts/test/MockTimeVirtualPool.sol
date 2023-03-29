// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.17;
pragma abicoder v1;

import '../interfaces/IAlgebraVirtualPool.sol';

contract MockTimeVirtualPool is IAlgebraVirtualPool {
  uint32 public timestamp;

  bool private isExist = true;
  bool private isStarted = true;

  int24 public currentTick;

  function setIsExist(bool _isExist) external {
    isExist = _isExist;
  }

  function setIsStarted(bool _isStarted) external {
    isStarted = _isStarted;
  }

  function crossTo(int24 nextTick, bool zeroToOne) external override returns (bool) {
    zeroToOne;
    if (!isExist) return false;
    currentTick = nextTick;
    unchecked {
      if (isStarted) timestamp = uint32(block.timestamp);
    }
    return true;
  }
}
