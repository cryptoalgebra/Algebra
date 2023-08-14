// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.20;

import '../interfaces/IAlgebraEternalVirtualPool.sol';

/// @dev Test contract for virtual pool onlyPool methods
contract PoolMock {
  address public plugin;

  address public virtualPool;

  function setPlugin(address newPlugin) external {
    plugin = newPlugin;
  }

  function setVirtualPool(address newVirtualPool) external {
    virtualPool = newVirtualPool;
  }

  function crossTo(int24 targetTick, bool zeroToOne) external returns (bool) {
    return IAlgebraEternalVirtualPool(virtualPool).crossTo(targetTick, zeroToOne);
  }
}
