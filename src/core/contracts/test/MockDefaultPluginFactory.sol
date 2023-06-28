pragma solidity =0.8.17;
pragma abicoder v1;

import '../interfaces/IAlgebraPluginFactory.sol';
import './MockPoolPlugin.sol';

// used for testing time dependent behavior
contract MockDefaultPluginFactory is IAlgebraPluginFactory {
  function createPlugin(address pool) external override returns (address plugin) {
    plugin = address(new MockPoolPlugin(pool));
  }
}
