// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import './BasePlugin.sol';

/// @title Algebra' internal Integral 1.2.2 plugin base
/// @notice This contract inherits BasePlugin and implements virtual functions
abstract contract AlgebraBasePlugin is BasePlugin {
  address internal immutable factory;

  constructor(address _pool, address _factory, address _pluginFactory) BasePlugin(_pool, _pluginFactory) {
    factory = _factory;
  }

  function _authorize() internal view virtual override {
    require(IAlgebraFactory(factory).hasRoleOrOwner(ALGEBRA_BASE_PLUGIN_MANAGER, msg.sender));
  }
}
