// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title Minimal interface for handling community fee notifications from pools
/// @dev Can be extended in derived contracts if additional logic is needed
interface IAlgebraCommunityVaultFeeHandler {
  /// @notice Called by the pool when community fees are sent to the vault
  /// @param token0 The address of token0
  /// @param token1 The address of token1
  /// @param amount0 The amount of token0 fees received
  /// @param amount1 The amount of token1 fees received
  function handleCommunityFee(address token0, address token1, uint256 amount0, uint256 amount1) external;
}
