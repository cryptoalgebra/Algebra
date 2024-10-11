// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title The Algebra plugin interface
/// @dev The plugin will be called by the pool using hook methods depending on the current pool settings
interface IAlgebraPlugin {
  /// @notice Returns plugin config
  /// @return config Each bit of the config is responsible for enabling/disabling the hooks.
  /// The last bit indicates whether the plugin contains dynamic fees logic
  function defaultPluginConfig() external view returns (uint8);

  /// @notice Handle plugin fee transfer on plugin contract
  /// @param pluginFee0 Fee0 amount transferred to plugin
  /// @param pluginFee1 Fee1 amount transferred to plugin
  /// @return bytes4 The function selector
  function handlePluginFee(uint256 pluginFee0, uint256 pluginFee1) external returns (bytes4);

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
  /// @param recipient Address to which the liquidity will be assigned in case of a mint or
  /// to which tokens will be sent in case of a burn
  /// @param bottomTick The lower tick of the position
  /// @param topTick The upper tick of the position
  /// @param desiredLiquidityDelta The desired amount of liquidity to mint/burn
  /// @param data Data that passed through the callback
  /// @return selector The function selector for the hook
  function beforeModifyPosition(
    address sender,
    address recipient,
    int24 bottomTick,
    int24 topTick,
    int128 desiredLiquidityDelta,
    bytes calldata data
  ) external returns (bytes4 selector, uint24 pluginFee);

  /// @notice The hook called after a position is modified
  /// @param sender The initial msg.sender for the modify position call
  /// @param recipient Address to which the liquidity will be assigned in case of a mint or
  /// to which tokens will be sent in case of a burn
  /// @param bottomTick The lower tick of the position
  /// @param topTick The upper tick of the position
  /// @param desiredLiquidityDelta The desired amount of liquidity to mint/burn
  /// @param amount0 The amount of token0 sent to the recipient or was paid to mint
  /// @param amount1 The amount of token0 sent to the recipient or was paid to mint
  /// @param data Data that passed through the callback
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
  /// @param recipient The address to receive the output of the swap
  /// @param zeroToOne The direction of the swap, true for token0 to token1, false for token1 to token0
  /// @param amountRequired The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative)
  /// @param limitSqrtPrice The Q64.96 sqrt price limit. If zero for one, the price cannot be less than this
  /// value after the swap. If one for zero, the price cannot be greater than this value after the swap
  /// @param withPaymentInAdvance The flag indicating whether the `swapWithPaymentInAdvance` method was called
  /// @param data Data that passed through the callback
  /// @return selector The function selector for the hook
  function beforeSwap(
    address sender,
    address recipient,
    bool zeroToOne,
    int256 amountRequired,
    uint160 limitSqrtPrice,
    bool withPaymentInAdvance,
    bytes calldata data
  ) external returns (bytes4 selector, uint24 feeOverride, uint24 pluginFee);

  /// @notice The hook called after a swap
  /// @param sender The initial msg.sender for the swap call
  /// @param recipient The address to receive the output of the swap
  /// @param zeroToOne The direction of the swap, true for token0 to token1, false for token1 to token0
  /// @param amountRequired The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative)
  /// @param limitSqrtPrice The Q64.96 sqrt price limit. If zero for one, the price cannot be less than this
  /// value after the swap. If one for zero, the price cannot be greater than this value after the swap
  /// @param amount0 The delta of the balance of token0 of the pool, exact when negative, minimum when positive
  /// @param amount1 The delta of the balance of token1 of the pool, exact when negative, minimum when positive
  /// @param data Data that passed through the callback
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
  /// @param recipient The address which will receive the token0 and token1 amounts
  /// @param amount0 The amount of token0 being requested for flash
  /// @param amount1 The amount of token1 being requested for flash
  /// @param data Data that passed through the callback
  /// @return bytes4 The function selector for the hook
  function beforeFlash(address sender, address recipient, uint256 amount0, uint256 amount1, bytes calldata data) external returns (bytes4);

  /// @notice The hook called after flash
  /// @param sender The initial msg.sender for the flash call
  /// @param recipient The address which will receive the token0 and token1 amounts
  /// @param amount0 The amount of token0 being requested for flash
  /// @param amount1 The amount of token1 being requested for flash
  /// @param paid0 The amount of token0 being paid for flash
  /// @param paid1 The amount of token1 being paid for flash
  /// @param data Data that passed through the callback
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
