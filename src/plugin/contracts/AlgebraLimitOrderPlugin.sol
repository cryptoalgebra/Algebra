// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/libraries/Plugins.sol';

import '@cryptoalgebra/integral-core/contracts/interfaces/plugin/IAlgebraPlugin.sol';

import './plugins/DynamicFeePlugin.sol';
import './plugins/FarmingProxyPlugin.sol';
import './plugins/SlidingFeePlugin.sol';
import './plugins/VolatilityOraclePlugin.sol';
import './interfaces/plugins/ILimitOrderPlugin.sol';
import './interfaces/IAlgebraLimitOrderPlugin.sol';

/// @title Algebra Integral 1.2 limit order plugin
contract AlgebraLimitOrderPlugin is BasePlugin, IAlgebraLimitOrderPlugin {
  using Plugins for uint8;

  /// @inheritdoc IAlgebraPlugin
  uint8 public constant override defaultPluginConfig = uint8(Plugins.AFTER_INIT_FLAG | Plugins.AFTER_SWAP_FLAG);

  address public limitOrderPlugin;

  constructor(address _pool, address _factory, address _pluginFactory) BasePlugin(_pool, _factory, _pluginFactory) {}

  // ###### HOOKS ######

  function beforeInitialize(address, uint160) external override onlyPool returns (bytes4) {
    _updatePluginConfigInPool(defaultPluginConfig);
    return IAlgebraPlugin.beforeInitialize.selector;
  }

  function afterInitialize(address, uint160, int24 tick) external override onlyPool returns (bytes4) {
    if (limitOrderPlugin != address(0)) {
      ILimitOrderPlugin(limitOrderPlugin).afterInitialize(pool, tick);
    }
    return IAlgebraPlugin.afterInitialize.selector;
  }

  /// @dev unused
  function beforeModifyPosition(address, address, int24, int24, int128, bytes calldata) external override onlyPool returns (bytes4, uint24) {
    _updatePluginConfigInPool(defaultPluginConfig); // should not be called, reset config
    return (IAlgebraPlugin.beforeModifyPosition.selector, 0);
  }

  /// @dev unused
  function afterModifyPosition(address, address, int24, int24, int128, uint256, uint256, bytes calldata) external override onlyPool returns (bytes4) {
    _updatePluginConfigInPool(defaultPluginConfig); // should not be called, reset config
    return IAlgebraPlugin.afterModifyPosition.selector;
  }

  function beforeSwap(address, address, bool, int256, uint160, bool, bytes calldata) external override onlyPool returns (bytes4, uint24, uint24) {
    return (IAlgebraPlugin.beforeSwap.selector, 0, 0);
  }

  function afterSwap(address, address, bool zeroToOne, int256, uint160, int256, int256, bytes calldata) external override onlyPool returns (bytes4) {
    if (limitOrderPlugin != address(0)) {
      (, int24 tick, , ) = _getPoolState();
      ILimitOrderPlugin(limitOrderPlugin).afterSwap(pool, zeroToOne, tick);
    }
    return IAlgebraPlugin.afterSwap.selector;
  }

  /// @dev unused
  function beforeFlash(address, address, uint256, uint256, bytes calldata) external override onlyPool returns (bytes4) {
    _updatePluginConfigInPool(defaultPluginConfig); // should not be called, reset config
    return IAlgebraPlugin.beforeFlash.selector;
  }

  /// @dev unused
  function afterFlash(address, address, uint256, uint256, uint256, uint256, bytes calldata) external override onlyPool returns (bytes4) {
    _updatePluginConfigInPool(defaultPluginConfig); // should not be called, reset config
    return IAlgebraPlugin.afterFlash.selector;
  }

  function setLimitOrderPlugin(address plugin) external override {
    require(msg.sender == pluginFactory || IAlgebraFactory(factory).hasRoleOrOwner(ALGEBRA_BASE_PLUGIN_MANAGER, msg.sender));

    limitOrderPlugin = plugin;
    emit LimitOrderPlugin(plugin);
  }
}