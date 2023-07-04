// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// TODO
interface IAlgebraPlugin {
  // TODO
  function defaultPluginConfig() external view returns (uint8);

  /// @notice The hook called before the state of a pool is initialized
  /// @param sender The initial msg.sender for the initialize call
  /// @param sqrtPriceX96 The sqrt(price) of the pool as a Q64.96
  /// @return bytes4 The function selector for the hook
  function beforeInitialize(address sender, uint160 sqrtPriceX96) external returns (bytes4);

  /// @notice The hook called after the state of a pool is initialized
  /// @param sender The initial msg.sender for the initialize call
  /// @param sqrtPriceX96 The sqrt(price) of the pool as a Q64.96
  /// @param tick The current tick after the state of a pool is initialized
  /// @return bytes4 The function selector for the hook
  function afterInitialize(address sender, uint160 sqrtPriceX96, int24 tick) external returns (bytes4);

  /// @notice The hook called before a position is modified
  /// @param sender The initial msg.sender for the modify position call
  /// @param recipient TODO
  /// @param bottomTick TODO
  /// @param topTick TODO
  /// @param desiredLiquidityDelta TODO
  /// @param data TODO
  /// @return bytes4 The function selector for the hook
  function beforeModifyPosition(
    address sender,
    address recipient,
    int24 bottomTick,
    int24 topTick,
    int128 desiredLiquidityDelta,
    bytes calldata data
  ) external returns (bytes4);

  /// @notice The hook called after a position is modified
  /// @param sender The initial msg.sender for the modify position call
  /// @param recipient TODO
  /// @param bottomTick TODO
  /// @param topTick TODO
  /// @param desiredLiquidityDelta TODO
  /// @param amount0 TODO
  /// @param amount1 TODO
  /// @param data TODO
  /// @return bytes4 The function selector for the hook
  function afterModifyPosition(
    address sender,
    address recipient,
    int24 bottomTick,
    int24 topTick,
    int128 desiredLiquidityDelta,
    uint256 amount0,
    uint256 amount1,
    bytes calldata data
  ) external returns (bytes4);

  /// @notice The hook called before a swap
  /// @param sender The initial msg.sender for the swap call
  /// @param recipient TODO
  /// @param zeroToOne TODO
  /// @param amountRequired TODO
  /// @param limitSqrtPrice TODO
  /// @param data TODO
  /// @return bytes4 The function selector for the hook
  function beforeSwap(
    address sender,
    address recipient,
    bool zeroToOne,
    int256 amountRequired,
    uint160 limitSqrtPrice,
    bytes calldata data
  ) external returns (bytes4);

  /// @notice The hook called after a swap
  /// @param sender The initial msg.sender for the swap call
  /// @param recipient TODO
  /// @param zeroToOne TODO
  /// @param amountRequired TODO
  /// @param limitSqrtPrice TODO
  /// @param amount0 TODO
  /// @param amount1 TODO
  /// @param data TODO
  /// @return bytes4 The function selector for the hook
  function afterSwap(
    address sender,
    address recipient,
    bool zeroToOne,
    int256 amountRequired,
    uint160 limitSqrtPrice,
    int256 amount0,
    int256 amount1,
    bytes calldata data
  ) external returns (bytes4);

  /// @notice The hook called before flash
  /// @param sender The initial msg.sender for the flash call
  /// @param recipient TODO
  /// @param amount0 The amount of token0 being requested for flash
  /// @param amount1 The amount of token1 being requested for flash
  /// @param data TODO
  /// @return bytes4 The function selector for the hook
  function beforeFlash(address sender, address recipient, uint256 amount0, uint256 amount1, bytes calldata data) external returns (bytes4);

  /// @notice The hook called after flash
  /// @param sender The initial msg.sender for the flash call
  /// @param recipient TODO
  /// @param amount0 The amount of token0 being requested for flash
  /// @param amount1 The amount of token1 being requested for flash
  /// @param paid0 The amount of token0 being paid for flash
  /// @param paid1 The amount of token1 being paid for flash
  /// @param data TODO
  /// @return bytes4 The function selector for the hook
  function afterFlash(
    address sender,
    address recipient,
    uint256 amount0,
    uint256 amount1,
    uint256 paid0,
    uint256 paid1,
    bytes calldata data
  ) external returns (bytes4);
}
