// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;
pragma abicoder v1;

import '../interfaces/plugin/IAlgebraPluginFactory.sol';
import './MockPoolPlugin.sol';

// used for testing time dependent behavior
contract MockDefaultPluginFactory is IAlgebraPluginFactory {
  mapping(address => address) public pluginsForPools;

  function createPlugin(address pool, address, address) external override returns (address plugin) {
    plugin = address(new MockPoolPlugin(pool));
    pluginsForPools[pool] = plugin;
  }
}
