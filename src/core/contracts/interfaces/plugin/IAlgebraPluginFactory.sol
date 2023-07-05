// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title An interface for a contract that is capable of deploying Algebra plugins
interface IAlgebraPluginFactory {
  /// @notice Deploys new plugin contract for pool
  /// @param pool The address of the pool for which the new plugin will be created
  /// @return New plugin address
  function createPlugin(address pool) external returns (address);
}
