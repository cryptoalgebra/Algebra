// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title The interface for the Algebra Vault Factory
interface IAlgebraVaultFactory {
  /// @notice
  /// @param pool
  /// @return
  function getVaultForPool(address pool) external view returns (address);

  /// @notice
  /// @param pool
  /// @return
  function createVaultForPool(address pool) external returns (address);
}
