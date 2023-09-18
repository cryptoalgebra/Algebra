// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;
pragma abicoder v1;

import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import '../interfaces/IAlgebraVirtualPool.sol';

contract TestVirtualPool is IAlgebraVirtualPool {
  struct Data {
    int24 tick;
  }

  Data[] private data;

  function crossTo(int24, bool) external override returns (bool) {
    for (uint i; i < 100; i++) {
      (, int24 poolTick, , , , ) = IAlgebraPool(msg.sender).globalState();
      data.push(Data(poolTick));
    }

    return true;
  }
}
