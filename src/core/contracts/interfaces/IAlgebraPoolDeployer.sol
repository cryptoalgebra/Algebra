// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title An interface for a contract that is capable of deploying Algebra Pools
/// @notice A contract that constructs a pool must implement this to pass arguments to the pool
/// @dev This is used to avoid having constructor arguments in the pool contract, which results in the init code hash
/// of the pool being constant allowing the CREATE2 address of the pool to be cheaply computed on-chain.
/// Credit to Uniswap Labs under GPL-2.0-or-later license:
/// https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces
interface IAlgebraPoolDeployer {
  /// @notice Get the parameters to be used in constructing the pool, set transiently during pool creation.
  /// @dev Called by the pool constructor to fetch the parameters of the pool
  /// @return plugin The pool associated plugin (if any)
  /// @return factory The Algebra Factory address
  /// @return token0 The first token of the pool by address sort order
  /// @return token1 The second token of the pool by address sort order
  function getDeployParameters() external view returns (address plugin, address factory, address token0, address token1);

  /// @dev Deploys a pool with the given parameters by transiently setting the parameters in cache.
  /// @param plugin The pool associated plugin (if any)
  /// @param token0 The first token of the pool by address sort order
  /// @param token1 The second token of the pool by address sort order
  /// @return pool The deployed pool's address
  function deploy(address plugin, address token0, address token1, address deployer) external returns (address pool);
}
