// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/**
 * @title An interface for a contract that is capable of deploying Algebra Pools
 * @notice A contract that constructs a pool must implement this to pass arguments to the pool
 * @dev This is used to avoid having constructor arguments in the pool contract, which results in the init code hash
 * of the pool being constant allowing the CREATE2 address of the pool to be cheaply computed on-chain.
 * Credit to Uniswap Labs under GPL-2.0-or-later license:
 * https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces
 */
interface IAlgebraPoolDeployer {
  /**
   *  @notice Emitted when the factory address is changed
   *  @param factory The factory address after the address was changed
   */
  event Factory(address indexed factory);

  /**
   * @notice Get the parameters to be used in constructing the pool, set transiently during pool creation.
   * @dev Called by the pool constructor to fetch the parameters of the pool
   * Returns dataStorage The pools associated dataStorage
   * Returns factory The factory address
   * Returns token0 The first token of the pool by address sort order
   * Returns token1 The second token of the pool by address sort order
   */
  function parameters()
    external
    view
    returns (
      address dataStorage,
      address factory,
      address token0,
      address token1
    );

  /**
   * @dev Deploys a pool with the given parameters by transiently setting the parameters storage slot and then
   * clearing it after deploying the pool.
   * @param dataStorage The pools associated dataStorage
   * @param factory The contract address of the Algebra factory
   * @param token0 The first token of the pool by address sort order
   * @param token1 The second token of the pool by address sort order
   * @return pool The deployed pool's address
   */
  function deploy(
    address dataStorage,
    address factory,
    address token0,
    address token1
  ) external returns (address pool);

  /**
   * @dev Sets the factory address to the poolDeployer for permissioned actions
   * @param factory The address of the Algebra factory
   */
  function setFactory(address factory) external;
}
