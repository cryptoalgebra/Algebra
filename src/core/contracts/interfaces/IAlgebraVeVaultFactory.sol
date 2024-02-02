// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

import './IAlgebraVaultFactory.sol';

/// @title The interface for the Algebra Vault Factory
interface IAlgebraVeVaultFactory is IAlgebraVaultFactory {
  event DefaultCommunityVault(address newDefaultCommunityVault);

  /// @notice Returns the address of AlgebraFactory
  /// @return The AlgebraFactory contract address
  function algebraFactory() external view returns (address);

  function defaultCommunityVault() external view returns (address);

  /// @notice Returns address of vault created for given AlgebraPool
  /// @param pool The address of pool
  /// @return The address of corresponding vault
  function vaultByPool(address pool) external view returns (address);

  /// @notice Create vault for already existing pool
  /// @param token0 The address of first token in pool
  /// @param token1 The address of second token in pool
  /// @return The address of created vault
  function createVaultForInitializedPool(address token0, address token1) external returns (address);

  function setDefaultCommunityVault(address pool) external;
}
