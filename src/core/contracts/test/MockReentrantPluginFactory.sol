// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../interfaces/plugin/IAlgebraPluginFactory.sol';
import '../interfaces/IAlgebraFactory.sol';

/// @dev Default plugin factory that reenters createPool from its hook
contract MockReentrantPluginFactory is IAlgebraPluginFactory {
  function beforeCreatePoolHook(address, address, address, address token0, address token1, bytes calldata) external override returns (address) {
    IAlgebraFactory(msg.sender).createPool(token0, token1, '');
    return address(0);
  }

  function afterCreatePoolHook(address, address, address) external override {}
}
