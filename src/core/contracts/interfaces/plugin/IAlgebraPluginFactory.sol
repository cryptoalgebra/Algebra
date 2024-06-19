// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title An interface for a contract that is capable of deploying Algebra plugins
/// @dev Such a factory can be used for automatic plugin creation for new pools.
/// Also a factory be used as an entry point for custom (additional) pools creation
interface IAlgebraPluginFactory {
  /// @notice Deploys new plugin contract for pool
  /// @param pool The address of the new pool
  /// @param creator The address that initiated the pool creation
  /// @param deployer The address of new plugin deployer contract (0 if not used)
  /// @param token0 First token of the pool
  /// @param token1 Second token of the pool
  /// @return New plugin address
  function beforeCreatePoolHook(
    address pool,
    address creator,
    address deployer,
    address token0,
    address token1,
    bytes calldata data
  ) external returns (address);

  /// @notice Called after the pool is created
  /// @param plugin The plugin address
  /// @param pool The address of the new pool
  /// @param deployer The address of new plugin deployer contract (0 if not used)
  function afterCreatePoolHook(address plugin, address pool, address deployer) external;
}
