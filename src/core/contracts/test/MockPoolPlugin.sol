// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.17;
pragma abicoder v1;

import '../interfaces/plugin/IAlgebraPlugin.sol';
import '../interfaces/plugin/IAlgebraDynamicFeePlugin.sol';
import '../interfaces/IAlgebraPool.sol';
import '../libraries/Plugins.sol';

contract MockPoolPlugin is IAlgebraPlugin, IAlgebraDynamicFeePlugin {
  address public pool;
  uint8 public selectorsDisableConfig;

  constructor(address _pool) {
    pool = _pool;
  }

  event BeforeInitialize(address sender, uint160 sqrtPriceX96);
  event AfterInitialize(address sender, uint160 sqrtPriceX96, int24 tick);
  event BeforeModifyPosition(address sender);
  event AfterModifyPosition(address sender);
  event BeforeSwap(address sender);
  event AfterSwap(address sender);
  event BeforeFlash(address sender, uint256 amount0, uint256 amount1);
  event AfterFlash(address sender, uint256 amount0, uint256 amount1);

  function defaultPluginConfig() external view override returns (uint8) {}

  function getCurrentFee() external pure override returns (uint16 fee) {
    return 220;
  }

  function setSelectorDisable(uint8 newSelectorsDisableConfig) external {
    selectorsDisableConfig = newSelectorsDisableConfig;
  }

  /// @notice The hook called before the state of a pool is initialized
  /// @param sender The initial msg.sender for the initialize call
  /// @param sqrtPriceX96 The sqrt(price) of the pool as a Q64.96
  /// @return bytes4 The function selector for the hook
  function beforeInitialize(address sender, uint160 sqrtPriceX96) external override returns (bytes4) {
    emit BeforeInitialize(sender, sqrtPriceX96);
    if (!Plugins.hasFlag(selectorsDisableConfig, Plugins.DYNAMIC_FEE)) return IAlgebraPlugin.beforeInitialize.selector;
    return IAlgebraPlugin.defaultPluginConfig.selector;
  }

  /// @notice The hook called after the state of a pool is initialized
  /// @param sender The initial msg.sender for the initialize call
  /// @param sqrtPriceX96 The sqrt(price) of the pool as a Q64.96
  /// @param tick The current tick after the state of a pool is initialized
  /// @return bytes4 The function selector for the hook
  function afterInitialize(address sender, uint160 sqrtPriceX96, int24 tick) external override returns (bytes4) {
    emit AfterInitialize(sender, sqrtPriceX96, tick);
    if (!Plugins.hasFlag(selectorsDisableConfig, Plugins.AFTER_INIT_FLAG)) return IAlgebraPlugin.afterInitialize.selector;
    return IAlgebraPlugin.defaultPluginConfig.selector;
  }

  /// @notice The hook called before a position is modified
  /// @param sender The initial msg.sender for the modify position call
  /// @return bytes4 The function selector for the hook
  function beforeModifyPosition(address sender, address, int24, int24, int128, bytes calldata) external override returns (bytes4) {
    emit BeforeModifyPosition(sender);
    if (!Plugins.hasFlag(selectorsDisableConfig, Plugins.BEFORE_POSITION_MODIFY_FLAG)) return IAlgebraPlugin.beforeModifyPosition.selector;
    return IAlgebraPlugin.defaultPluginConfig.selector;
  }

  /// @notice The hook called after a position is modified
  /// @param sender The initial msg.sender for the modify position call
  /// @return bytes4 The function selector for the hook
  function afterModifyPosition(address sender, address, int24, int24, int128, uint256, uint256, bytes calldata) external override returns (bytes4) {
    emit AfterModifyPosition(sender);
    if (!Plugins.hasFlag(selectorsDisableConfig, Plugins.AFTER_POSITION_MODIFY_FLAG)) return IAlgebraPlugin.afterModifyPosition.selector;
    return IAlgebraPlugin.defaultPluginConfig.selector;
  }

  /// @notice The hook called before a swap
  /// @param sender The initial msg.sender for the swap call
  /// @return bytes4 The function selector for the hook
  function beforeSwap(address sender, address, bool, int256, uint160, bool, bytes calldata) external override returns (bytes4) {
    emit BeforeSwap(sender);
    if (!Plugins.hasFlag(selectorsDisableConfig, Plugins.BEFORE_SWAP_FLAG)) return IAlgebraPlugin.beforeSwap.selector;
    return IAlgebraPlugin.defaultPluginConfig.selector;
  }

  /// @notice The hook called after a swap
  /// @param sender The initial msg.sender for the swap call
  /// @return bytes4 The function selector for the hook
  function afterSwap(address sender, address, bool, int256, uint160, int256, int256, bytes calldata) external override returns (bytes4) {
    emit AfterSwap(sender);
    if (!Plugins.hasFlag(selectorsDisableConfig, Plugins.AFTER_SWAP_FLAG)) return IAlgebraPlugin.afterSwap.selector;
    return IAlgebraPlugin.defaultPluginConfig.selector;
  }

  /// @notice The hook called before flash
  /// @param sender The initial msg.sender for the flash call
  /// @param amount0 The amount of token0 being requested for flash
  /// @param amount1 The amount of token1 being requested for flash
  /// @return bytes4 The function selector for the hook
  function beforeFlash(address sender, address, uint256 amount0, uint256 amount1, bytes calldata) external override returns (bytes4) {
    emit BeforeFlash(sender, amount0, amount1);
    IAlgebraPool(pool).setFee(200);
    if (!Plugins.hasFlag(selectorsDisableConfig, Plugins.BEFORE_FLASH_FLAG)) return IAlgebraPlugin.beforeFlash.selector;
    return IAlgebraPlugin.defaultPluginConfig.selector;
  }

  /// @notice The hook called after flash
  /// @param sender The initial msg.sender for the flash call
  /// @param amount0 The amount of token0 being requested for flash
  /// @param amount1 The amount of token1 being requested for flash
  /// @return bytes4 The function selector for the hook
  function afterFlash(
    address sender,
    address,
    uint256 amount0,
    uint256 amount1,
    uint256,
    uint256,
    bytes calldata
  ) external override returns (bytes4) {
    emit AfterFlash(sender, amount0, amount1);
    if (!Plugins.hasFlag(selectorsDisableConfig, Plugins.AFTER_FLASH_FLAG)) return IAlgebraPlugin.afterFlash.selector;
    return IAlgebraPlugin.defaultPluginConfig.selector;
  }
}
