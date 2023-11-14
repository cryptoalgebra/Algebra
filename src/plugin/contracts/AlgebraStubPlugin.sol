// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/interfaces/plugin/IAlgebraPlugin.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/Plugins.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraFactory.sol';

import './interfaces/plugins/IAlgebraStubPlugin.sol';

contract AlgebraStubPlugin is IAlgebraStubPlugin, IAlgebraPlugin {
  using Plugins for uint8;

  /// @dev The role can be granted in AlgebraFactory
  bytes32 public constant ALGEBRA_BASE_PLUGIN_MANAGER = keccak256('ALGEBRA_BASE_PLUGIN_MANAGER');

  uint8 public override pluginConfig;
  uint8 public constant override defaultPluginConfig = 0;

  address private immutable factory;

  constructor(address _factory) {
    factory = _factory;
    pluginConfig = defaultPluginConfig;
  }

  function setNewPluginConfig(uint8 _pluginConfig) external override {
    require(IAlgebraFactory(factory).hasRoleOrOwner(ALGEBRA_BASE_PLUGIN_MANAGER, msg.sender));
    pluginConfig = _pluginConfig;
    emit newPluginConfig(_pluginConfig);
  }

  // ###### HOOKS ######

  function beforeInitialize(address, uint160) external pure override returns (bytes4) {
    return IAlgebraPlugin.beforeInitialize.selector;
  }

  function afterInitialize(address, uint160, int24) external view override returns (bytes4) {
    if (!pluginConfig.hasFlag(Plugins.AFTER_INIT_FLAG)) revert afterInitializeHookDisabled();
    return IAlgebraPlugin.afterInitialize.selector;
  }

  function beforeModifyPosition(address, address, int24, int24, int128, bytes calldata) external view override returns (bytes4) {
    if (!pluginConfig.hasFlag(Plugins.BEFORE_POSITION_MODIFY_FLAG)) revert beforePositionHookDisabled();
    return IAlgebraPlugin.beforeModifyPosition.selector;
  }

  function afterModifyPosition(address, address, int24, int24, int128, uint256, uint256, bytes calldata) external view override returns (bytes4) {
    if (!pluginConfig.hasFlag(Plugins.AFTER_POSITION_MODIFY_FLAG)) revert afterPositionHookDisabled();
    return IAlgebraPlugin.afterModifyPosition.selector;
  }

  function beforeSwap(address, address, bool, int256, uint160, bool, bytes calldata) external view override returns (bytes4) {
    if (!pluginConfig.hasFlag(Plugins.BEFORE_SWAP_FLAG)) revert beforeSwapHookDisabled();
    return IAlgebraPlugin.beforeSwap.selector;
  }

  function afterSwap(address, address, bool, int256, uint160, int256, int256, bytes calldata) external view override returns (bytes4) {
    if (!pluginConfig.hasFlag(Plugins.AFTER_SWAP_FLAG)) revert afterSwapHookDisabled();
    return IAlgebraPlugin.afterSwap.selector;
  }

  function beforeFlash(address, address, uint256, uint256, bytes calldata) external view override returns (bytes4) {
    if (!pluginConfig.hasFlag(Plugins.BEFORE_FLASH_FLAG)) revert beforeFlashHookDisabled();
    return IAlgebraPlugin.beforeFlash.selector;
  }

  function afterFlash(address, address, uint256, uint256, uint256, uint256, bytes calldata) external view override returns (bytes4) {
    if (!pluginConfig.hasFlag(Plugins.AFTER_FLASH_FLAG)) revert afterFlashHookDisabled();
    return IAlgebraPlugin.afterFlash.selector;
  }
}
