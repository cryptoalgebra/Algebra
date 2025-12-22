// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import '@cryptoalgebra/integral-core/contracts/interfaces/plugin/IAlgebraPluginFactory.sol';
import './MockPlugin.sol';

// used for testing time dependent behavior
contract MockPluginFactory is IAlgebraPluginFactory {
  mapping(address => address) public pluginsForPools;

  event DataOnPoolCreation(bytes data);

  function afterCreatePoolHook(address plugin, address pool, address deployer) external override {}

  function beforeCreatePoolHook(address pool, address, address, address, address, bytes calldata data) external override returns (address plugin) {
    plugin = address(new MockPlugin(pool));
    pluginsForPools[pool] = plugin;
    emit DataOnPoolCreation(data);
  }
}
