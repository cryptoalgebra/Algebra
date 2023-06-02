// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.17;
pragma abicoder v1;

import '../interfaces/IAlgebraVirtualPool.sol';
import '../interfaces/IAlgebraPool.sol';

contract TestVirtualPool is IAlgebraVirtualPool {
  struct Data {
    int24 tick;
  }

  Data[] private data;

  function crossTo(int24 targetTick, bool zeroToOne) external override returns (bool) {
    for (uint i; i < 100; i++) {
      (, int24 poolTick, , , , , ) = IAlgebraPool(msg.sender).globalState();
      data[i].tick = poolTick;
    }

    return true;
  }
}
