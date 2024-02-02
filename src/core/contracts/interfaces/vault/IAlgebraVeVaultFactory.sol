// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

import './IAlgebraVaultFactory.sol';

/// @title The interface for the Algebra Vault Factory
interface IAlgebraVeVaultFactory is IAlgebraVaultFactory {
  /// @notice Emmited when the default community vault address changes
  /// @param newDefaultCommunityVault New default community Vault
  event DefaultCommunityVault(address newDefaultCommunityVault);

  /// @notice Returns the address of AlgebraFactory
  /// @return The AlgebraFactory contract address
  function algebraFactory() external view returns (address);

  /// @notice Retuens the address of default community vault
  /// @return The default community vault address
  function defaultCommunityVault() external view returns (address);

  /// @notice Returns address of vault created for given AlgebraPool
  /// @param pool The address of pool
  /// @return The address of corresponding vault
  function vaultByPool(address pool) external view returns (address);

  /// @notice Create vault for already initialized pool
  /// @param token0 The address of first token in pool
  /// @param token1 The address of second token in pool
  /// @return The address of created vault
  function createVaultForInitializedPool(address token0, address token1) external returns (address);

  /// @notice Set new default community fee address
  /// @param newDefaultCommunityVault The address of new default community fee vault
  function setDefaultCommunityVault(address newDefaultCommunityVault) external;
}
