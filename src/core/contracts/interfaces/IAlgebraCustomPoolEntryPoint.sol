// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

import './plugin/IAlgebraPluginFactory.sol';

/// @title An interface for a contract that is used to deploy and manage Algebra Integral custom pools
/// @dev This contract should be called by every custom pool deployer to create new custom pools or manage existing ones.
interface IAlgebraCustomPoolEntryPoint is IAlgebraPluginFactory {
  /// @notice Returns the address of corresponding AlgebraFactory contract
  /// @return factory The address of AlgebraFactory
  function factory() external view returns (address factory);

  /// @notice Changes the tick spacing value in the Algebra Integral custom pool
  /// @dev Only corresponding custom pool deployer contract can call this function
  /// @param pool The address of the Algebra Integral custom pool
  /// @param newTickSpacing The new tick spacing value
  function setTickSpacing(address pool, int24 newTickSpacing) external;

  /// @notice Changes the plugin address in the Algebra Integral custom pool
  /// @dev Only corresponding custom pool deployer contract can call this function
  /// @param pool The address of the Algebra Integral custom pool
  /// @param newPluginAddress The new plugin address
  function setPlugin(address pool, address newPluginAddress) external;

  /// @notice Changes the plugin configuration in the Algebra Integral custom pool
  /// @dev Only corresponding custom pool deployer contract can call this function
  /// @param pool The address of the Algebra Integral custom pool
  /// @param newConfig The new plugin configuration bitmap
  function setPluginConfig(address pool, uint8 newConfig) external;

  /// @notice Changes the fee value in the Algebra Integral custom pool
  /// @dev Only corresponding custom pool deployer contract can call this function.
  /// Fee can be changed manually only if pool does not have "dynamic fee" configuration
  /// @param pool The address of the Algebra Integral custom pool
  /// @param newFee The new fee value
  function setFee(address pool, uint16 newFee) external;
}
