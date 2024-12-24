// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/libraries/Plugins.sol';

import '@cryptoalgebra/integral-core/contracts/interfaces/plugin/IAlgebraPlugin.sol';

import './plugins/SecurityPlugin.sol';

/// @title Algebra Integral 1.2 security plugin
contract AlgebraSecurityPlugin is SecurityPlugin {
  using Plugins for uint8;

  /// @inheritdoc IAlgebraPlugin
  uint8 public constant override defaultPluginConfig =
    uint8(Plugins.BEFORE_POSITION_MODIFY_FLAG | Plugins.BEFORE_SWAP_FLAG | Plugins.BEFORE_FLASH_FLAG);

  constructor(address _pool, address _factory, address _pluginFactory) BasePlugin(_pool, _factory, _pluginFactory) {}

  // ###### HOOKS ######

  /// @dev unused
  function beforeInitialize(address, uint160) external override onlyPool returns (bytes4) {
    _updatePluginConfigInPool(defaultPluginConfig);
    return IAlgebraPlugin.beforeInitialize.selector;
  }

  /// @dev unused
  function afterInitialize(address, uint160, int24) external override onlyPool returns (bytes4) {
    _updatePluginConfigInPool(defaultPluginConfig);
    return IAlgebraPlugin.afterInitialize.selector;
  }

  /// @dev
  function beforeModifyPosition(
    address,
    address,
    int24,
    int24,
    int128 liquidity,
    bytes calldata
  ) external override onlyPool returns (bytes4, uint24) {
    if (liquidity < 0) {
      _checkStatusOnBurn();
    } else {
      _checkStatus();
    }
    return (IAlgebraPlugin.beforeModifyPosition.selector, 0);
  }

  /// @dev unused
  function afterModifyPosition(address, address, int24, int24, int128, uint256, uint256, bytes calldata) external override onlyPool returns (bytes4) {
    _updatePluginConfigInPool(defaultPluginConfig); // should not be called, reset config
    return IAlgebraPlugin.afterModifyPosition.selector;
  }

  function beforeSwap(address, address, bool, int256, uint160, bool, bytes calldata) external override onlyPool returns (bytes4, uint24, uint24) {
    _checkStatus();
    return (IAlgebraPlugin.beforeSwap.selector, 0, 0);
  }
  /// @dev unused
  function afterSwap(address, address, bool, int256, uint160, int256, int256, bytes calldata) external override onlyPool returns (bytes4) {
    _updatePluginConfigInPool(defaultPluginConfig); // should not be called, reset config
    return IAlgebraPlugin.afterSwap.selector;
  }

  /// @dev
  function beforeFlash(address, address, uint256, uint256, bytes calldata) external override onlyPool returns (bytes4) {
    _checkStatus();
    return IAlgebraPlugin.beforeFlash.selector;
  }

  /// @dev unused
  function afterFlash(address, address, uint256, uint256, uint256, uint256, bytes calldata) external override onlyPool returns (bytes4) {
    _updatePluginConfigInPool(defaultPluginConfig); // should not be called, reset config
    return IAlgebraPlugin.afterFlash.selector;
  }
}
