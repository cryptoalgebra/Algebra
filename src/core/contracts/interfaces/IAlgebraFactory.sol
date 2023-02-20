// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;
pragma abicoder v2;

import './IAlgebraFeeConfiguration.sol';

/**
 * @title The interface for the Algebra Factory
 * @dev Credit to Uniswap Labs under GPL-2.0-or-later license:
 * https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces
 */
interface IAlgebraFactory {
  /**
   *  @notice Emitted when the owner of the factory is changed
   *  @param newOwner The owner after the owner was changed
   */
  event Owner(address indexed newOwner);

  /**
   *  @notice Emitted when a pool is created
   *  @param token0 The first token of the pool by address sort order
   *  @param token1 The second token of the pool by address sort order
   *  @param pool The address of the created pool
   */
  event Pool(address indexed token0, address indexed token1, address pool);

  /**
   *  @notice Emitted when the farming address is changed
   *  @param newFarmingAddress The farming address after the address was changed
   */
  event FarmingAddress(address indexed newFarmingAddress);

  /**
   *  @notice Emitted when the fee configuration is changed
   *  @param alpha1 max value of the first sigmoid
   *  @param alpha2 max value of the second sigmoid
   *  @param beta1 shift along the x-axis for the first sigmoid
   *  @param beta2 shift along the x-axis for the second sigmoid
   *  @param gamma1 horizontal stretch factor for the first sigmoid
   *  @param gamma2 horizontal stretch factor for the second sigmoid
   *  @param baseFee minimum possible fee
   */
  event FeeConfiguration(uint16 alpha1, uint16 alpha2, uint32 beta1, uint32 beta2, uint16 gamma1, uint16 gamma2, uint16 baseFee);

  /**
   *  @notice Emitted when the default community fee is changed
   *  @param newDefaultCommunityFee The new default community fee value
   */
  event DefaultCommunityFee(uint8 newDefaultCommunityFee);

  /**
   *  @notice Returns the current owner of the factory
   *  @dev Can be changed by the current owner via setOwner
   *  @return The address of the factory owner
   */
  function owner() external view returns (address);

  /**
   *  @notice Returns the current poolDeployerAddress
   *  @return The address of the poolDeployer
   */
  function poolDeployer() external view returns (address);

  /**
   * @dev Is retrieved from the pools to restrict calling
   * certain functions not by a tokenomics contract
   * @return The tokenomics contract address
   */
  function farmingAddress() external view returns (address);

  /**
   *  @notice Returns the current communityVaultAddress
   *  @return The address to which community fees are transferred
   */
  function communityVault() external view returns (address);

  /**
   *  @notice Returns the default community fee
   *  @return Fee which will be set at the creation of the pool
   */
  function defaultCommunityFee() external view returns (uint8);

  /**
   *  @notice Returns the pool address for a given pair of tokens, or address 0 if it does not exist
   *  @dev tokenA and tokenB may be passed in either token0/token1 or token1/token0 order
   *  @param tokenA The contract address of either token0 or token1
   *  @param tokenB The contract address of the other token
   *  @return pool The pool address
   */
  function poolByPair(address tokenA, address tokenB) external view returns (address pool);

  /**
   *  @notice Creates a pool for the given two tokens
   *  @param tokenA One of the two tokens in the desired pool
   *  @param tokenB The other of the two tokens in the desired pool
   *  @dev tokenA and tokenB may be passed in either order: token0/token1 or token1/token0.
   *  The call will revert if the pool already exists or the token arguments
   *  are invalid.
   *  @return pool The address of the newly created pool
   */
  function createPool(address tokenA, address tokenB) external returns (address pool);

  /**
   *  @notice Starts the ownership transfer of the contract to a new account
   *  @dev Must be called by the current owner
   *  @param _owner The new owner of the factory
   */
  function setOwner(address _owner) external;

  /**
   *  @notice The new owner accepts the ownership transfer
   */
  function acceptOwnership() external;

  /**
   *  @notice Set owner to zero address
   */
  function renounceOwnership() external;

  /**
   * @dev updates tokenomics address on the factory
   * @param _farmingAddress The new tokenomics contract address
   */
  function setFarmingAddress(address _farmingAddress) external;

  /**
   * @dev updates default community fee for new pools
   * @param newDefaultCommunityFee The new community fee, _must_ be <= MAX_COMMUNITY_FEE
   */
  function setDefaultCommunityFee(uint8 newDefaultCommunityFee) external;

  /**
   * @notice Changes initial fee configuration for new pools
   * @dev changes coefficients for sigmoids: α / (1 + e^( (β-x) / γ))
   * alpha1 + alpha2 + baseFee (max possible fee) must be <= type(uint16).max
   * gammas must be > 0
   * @param newConfig new default fee configuration. See the #AdaptiveFee.sol library for details
   */
  function setBaseFeeConfiguration(IAlgebraFeeConfiguration.Configuration calldata newConfig) external;
}
