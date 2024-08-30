// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/base/common/Timestamp.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/Plugins.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/SafeTransfer.sol';

import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraFactory.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/pool/IAlgebraPoolState.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';

import '../interfaces/IBasePlugin.sol';

/// @title Algebra Integral 1.1 default plugin
/// @notice This contract stores timepoints and calculates adaptive fee and statistical averages
abstract contract BasePlugin is IBasePlugin, Timestamp {
  using Plugins for uint8;

  /// @dev The role can be granted in AlgebraFactory
  bytes32 public constant ALGEBRA_BASE_PLUGIN_MANAGER = keccak256('ALGEBRA_BASE_PLUGIN_MANAGER');

  uint8 private constant defaultPluginConfig = 0;

  address internal immutable pool;
  address internal immutable factory;
  address internal immutable pluginFactory;

  modifier onlyPool() {
    _checkIfFromPool();
    _;
  }

  constructor(address _pool, address _factory, address _pluginFactory) {
    (factory, pool, pluginFactory) = (_factory, _pool, _pluginFactory);
  }

  function _checkIfFromPool() internal view {
    require(msg.sender == pool, 'Only pool can call this');
  }

  function _getPoolState() internal view returns (uint160 price, int24 tick, uint16 fee, uint8 pluginConfig) {
    (price, tick, fee, pluginConfig, , ) = IAlgebraPoolState(pool).globalState();
  }

  function _getPluginInPool() internal view returns (address plugin) {
    return IAlgebraPool(pool).plugin();
  }

  // ###### HOOKS ######

  function beforeInitialize(address, uint160) external virtual override onlyPool returns (bytes4) {
    return IAlgebraPlugin.beforeInitialize.selector;
  }

  function afterInitialize(address, uint160, int24) external virtual override onlyPool returns (bytes4) {
    return IAlgebraPlugin.afterInitialize.selector;
  }

  function beforeModifyPosition(address, address, int24, int24, int128, bytes calldata) external virtual override onlyPool returns (bytes4) {
    return IAlgebraPlugin.beforeModifyPosition.selector;
  }

  function afterModifyPosition(
    address,
    address,
    int24,
    int24,
    int128,
    uint256,
    uint256,
    bytes calldata
  ) external virtual override onlyPool returns (bytes4) {
    return IAlgebraPlugin.afterModifyPosition.selector;
  }

  function beforeSwap(address, address, bool, int256, uint160, bool, bytes calldata) external virtual override onlyPool returns (bytes4) {
    return IAlgebraPlugin.beforeSwap.selector;
  }

  function afterSwap(address, address, bool, int256, uint160, int256, int256, bytes calldata) external virtual override onlyPool returns (bytes4) {
    return IAlgebraPlugin.afterSwap.selector;
  }

  function beforeFlash(address, address, uint256, uint256, bytes calldata) external virtual override onlyPool returns (bytes4) {
    return IAlgebraPlugin.beforeFlash.selector;
  }

  function afterFlash(address, address, uint256, uint256, uint256, uint256, bytes calldata) external virtual override onlyPool returns (bytes4) {
    return IAlgebraPlugin.afterFlash.selector;
  }

  function _updatePluginConfigInPool(uint8 newPluginConfig) internal {
    (, , , uint8 currentPluginConfig) = _getPoolState();
    if (currentPluginConfig != newPluginConfig) {
      IAlgebraPool(pool).setPluginConfig(newPluginConfig);
    }
  }

  function _disablePluginFlags(uint8 config) internal {
    (, , , uint8 currentPluginConfig) = _getPoolState();
    uint8 newPluginConfig = currentPluginConfig & ~config;
    if (currentPluginConfig != newPluginConfig) {
      IAlgebraPool(pool).setPluginConfig(newPluginConfig);
    }
  }

  function _enablePluginFlags(uint8 config) internal {
    (, , , uint8 currentPluginConfig) = _getPoolState();
    uint8 newPluginConfig = currentPluginConfig | config;
    if (currentPluginConfig != newPluginConfig) {
      IAlgebraPool(pool).setPluginConfig(newPluginConfig);
    }
  }
}
