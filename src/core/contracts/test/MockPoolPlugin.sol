// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.17;
pragma abicoder v1;

import '../interfaces/IAlgebraPlugin.sol';

contract MockPoolPlugin is IAlgebraPlugin {
  address public pool;

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

  /// @notice The hook called before the state of a pool is initialized
  /// @param sender The initial msg.sender for the initialize call
  /// @param sqrtPriceX96 The sqrt(price) of the pool as a Q64.96
  /// @return bytes4 The function selector for the hook
  function beforeInitialize(address sender, uint160 sqrtPriceX96) external override returns (bytes4) {
    emit BeforeInitialize(sender, sqrtPriceX96);
  }

  /// @notice The hook called after the state of a pool is initialized
  /// @param sender The initial msg.sender for the initialize call
  /// @param sqrtPriceX96 The sqrt(price) of the pool as a Q64.96
  /// @param tick The current tick after the state of a pool is initialized
  /// @return bytes4 The function selector for the hook
  function afterInitialize(address sender, uint160 sqrtPriceX96, int24 tick) external override returns (bytes4) {
    emit AfterInitialize(sender, sqrtPriceX96, tick);
  }

  /// @notice The hook called before a position is modified
  /// @param sender The initial msg.sender for the modify position call
  /// @return bytes4 The function selector for the hook
  function beforeModifyPosition(address sender) external override returns (bytes4) {
    emit BeforeModifyPosition(sender);
  }

  /// @notice The hook called after a position is modified
  /// @param sender The initial msg.sender for the modify position call
  /// @return bytes4 The function selector for the hook
  function afterModifyPosition(address sender) external override returns (bytes4) {
    emit AfterModifyPosition(sender);
  }

  /// @notice The hook called before a swap
  /// @param sender The initial msg.sender for the swap call
  /// @return bytes4 The function selector for the hook
  function beforeSwap(address sender) external override returns (bytes4) {
    emit BeforeSwap(sender);
  }

  /// @notice The hook called after a swap
  /// @param sender The initial msg.sender for the swap call
  /// @return bytes4 The function selector for the hook
  function afterSwap(address sender) external override returns (bytes4) {
    emit AfterSwap(sender);
  }

  /// @notice The hook called before flash
  /// @param sender The initial msg.sender for the flash call
  /// @param amount0 The amount of token0 being requested for flash
  /// @param amount1 The amount of token1 being requested for flash
  /// @return bytes4 The function selector for the hook
  function beforeFlash(address sender, uint256 amount0, uint256 amount1) external override returns (bytes4) {
    emit BeforeFlash(sender, amount0, amount1);
  }

  /// @notice The hook called after flash
  /// @param sender The initial msg.sender for the flash call
  /// @param amount0 The amount of token0 being requested for flash
  /// @param amount1 The amount of token1 being requested for flash
  /// @return bytes4 The function selector for the hook
  function afterFlash(
    address sender,
    uint256 amount0,
    uint256 amount1 // TODO params
  ) external override returns (bytes4) {
    emit AfterFlash(sender, amount0, amount1);
  }
}
