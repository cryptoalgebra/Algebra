// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/libraries/Plugins.sol';

import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';

import '../interfaces/IBasePluginV1Factory.sol';
import '../interfaces/plugins/ISecurityPlugin.sol';
import '../interfaces/plugins/ISecurityRegistry.sol';

import '../base/BasePlugin.sol';

/// @title Algebra Integral 1.2 security plugin
abstract contract SecurityPlugin is BasePlugin, ISecurityPlugin {
  using Plugins for uint8;

  uint8 private constant defaultPluginConfig = uint8(Plugins.BEFORE_SWAP_FLAG | Plugins.BEFORE_FLASH_FLAG | Plugins.BEFORE_POSITION_MODIFY_FLAG);

  address internal securityRegistry;

  error PoolDisabled();
  error BurnOnly();

  function _checkStatus(bool isBurn) internal {
    ISecurityRegistry.Status status = ISecurityRegistry(securityRegistry).getPoolStatus(msg.sender);
    if (status == ISecurityRegistry.Status.DISABLED) {
      _updatePluginConfigInPool(defaultPluginConfig);
      revert PoolDisabled();
    } else if (status == ISecurityRegistry.Status.BURN_ONLY && isBurn == true) {
      _updatePluginConfigInPool(defaultPluginConfig);
      revert BurnOnly();
    }
  }

  function setSecurityRegistry(address _securityRegistry) external override {
    securityRegistry = _securityRegistry;
    require(msg.sender == pluginFactory || IAlgebraFactory(factory).hasRoleOrOwner(ALGEBRA_BASE_PLUGIN_MANAGER, msg.sender));
    emit SecurityRegistry(_securityRegistry);
  }

  function getSecurityRegistry() external view override returns (address) {
    return securityRegistry;
  }
}
