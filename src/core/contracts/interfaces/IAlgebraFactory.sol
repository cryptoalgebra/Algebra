// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;
pragma abicoder v2;

import './plugin/IAlgebraPluginFactory.sol';
import './vault/IAlgebraVaultFactory.sol';

/// @title The interface for the Algebra Factory
/// @dev Credit to Uniswap Labs under GPL-2.0-or-later license:
/// https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces
interface IAlgebraFactory {
  /// @notice Emitted when a process of ownership renounce is started
  /// @param timestamp The timestamp of event
  /// @param finishTimestamp The timestamp when ownership renounce will be possible to finish
  event RenounceOwnershipStart(uint256 timestamp, uint256 finishTimestamp);

  /// @notice Emitted when a process of ownership renounce cancelled
  /// @param timestamp The timestamp of event
  event RenounceOwnershipStop(uint256 timestamp);

  /// @notice Emitted when a process of ownership renounce finished
  /// @param timestamp The timestamp of ownership renouncement
  event RenounceOwnershipFinish(uint256 timestamp);

  /// @notice Emitted when a pool is created
  /// @param token0 The first token of the pool by address sort order
  /// @param token1 The second token of the pool by address sort order
  /// @param pool The address of the created pool
  event Pool(address indexed token0, address indexed token1, address pool);

  /// @notice Emitted when a pool is created
  /// @param deployer The corresponding custom deployer contract
  /// @param token0 The first token of the pool by address sort order
  /// @param token1 The second token of the pool by address sort order
  /// @param pool The address of the created pool
  event CustomPool(address indexed deployer, address indexed token0, address indexed token1, address pool);

  /// @notice Emitted when the default community fee is changed
  /// @param newDefaultCommunityFee The new default community fee value
  event DefaultCommunityFee(uint16 newDefaultCommunityFee);

  /// @notice Emitted when the default tickspacing is changed
  /// @param newDefaultTickspacing The new default tickspacing value
  event DefaultTickspacing(int24 newDefaultTickspacing);

  /// @notice Emitted when the default fee is changed
  /// @param newDefaultFee The new default fee value
  event DefaultFee(uint16 newDefaultFee);

  /// @notice Emitted when the defaultPluginFactory address is changed
  /// @param defaultPluginFactoryAddress The new defaultPluginFactory address
  event DefaultPluginFactory(address defaultPluginFactoryAddress);

  /// @notice Emitted when the vaultFactory address is changed
  /// @param newVaultFactory The new vaultFactory address
  event VaultFactory(address newVaultFactory);

  /// @notice role that can change communityFee and tickspacing in pools
  /// @return The hash corresponding to this role
  function POOLS_ADMINISTRATOR_ROLE() external view returns (bytes32);

  /// @notice role that can call `createCustomPool` function
  /// @return The hash corresponding to this role
  function CUSTOM_POOL_DEPLOYER() external view returns (bytes32);

  /// @notice Returns `true` if `account` has been granted `role` or `account` is owner.
  /// @param role The hash corresponding to the role
  /// @param account The address for which the role is checked
  /// @return bool Whether the address has this role or the owner role or not
  function hasRoleOrOwner(bytes32 role, address account) external view returns (bool);

  /// @notice Returns the current owner of the factory
  /// @dev Can be changed by the current owner via transferOwnership(address newOwner)
  /// @return The address of the factory owner
  function owner() external view returns (address);

  /// @notice Returns the current poolDeployerAddress
  /// @return The address of the poolDeployer
  function poolDeployer() external view returns (address);

  /// @notice Returns the default community fee
  /// @return Fee which will be set at the creation of the pool
  function defaultCommunityFee() external view returns (uint16);

  /// @notice Returns the default fee
  /// @return Fee which will be set at the creation of the pool
  function defaultFee() external view returns (uint16);

  /// @notice Returns the default tickspacing
  /// @return Tickspacing which will be set at the creation of the pool
  function defaultTickspacing() external view returns (int24);

  /// @notice Return the current pluginFactory address
  /// @dev This contract is used to automatically set a plugin address in new liquidity pools
  /// @return Algebra plugin factory
  function defaultPluginFactory() external view returns (IAlgebraPluginFactory);

  /// @notice Return the current vaultFactory address
  /// @dev This contract is used to automatically set a vault address in new liquidity pools
  /// @return Algebra vault factory
  function vaultFactory() external view returns (IAlgebraVaultFactory);

  /// @notice Returns the default communityFee, tickspacing, fee and communityFeeVault for pool
  /// @return communityFee which will be set at the creation of the pool
  /// @return tickSpacing which will be set at the creation of the pool
  /// @return fee which will be set at the creation of the pool
  function defaultConfigurationForPool() external view returns (uint16 communityFee, int24 tickSpacing, uint16 fee);

  /// @notice Deterministically computes the pool address given the token0 and token1
  /// @dev The method does not check if such a pool has been created
  /// @param token0 first token
  /// @param token1 second token
  /// @return pool The contract address of the Algebra pool
  function computePoolAddress(address token0, address token1) external view returns (address pool);

  /// @notice Deterministically computes the custom pool address given the customDeployer, token0 and token1
  /// @dev The method does not check if such a pool has been created
  /// @param customDeployer the address of custom plugin deployer
  /// @param token0 first token
  /// @param token1 second token
  /// @return customPool The contract address of the Algebra pool
  function computeCustomPoolAddress(address customDeployer, address token0, address token1) external view returns (address customPool);

  /// @notice Returns the pool address for a given pair of tokens, or address 0 if it does not exist
  /// @dev tokenA and tokenB may be passed in either token0/token1 or token1/token0 order
  /// @param tokenA The contract address of either token0 or token1
  /// @param tokenB The contract address of the other token
  /// @return pool The pool address
  function poolByPair(address tokenA, address tokenB) external view returns (address pool);

  /// @notice Returns the custom pool address for a customDeployer and a given pair of tokens, or address 0 if it does not exist
  /// @dev tokenA and tokenB may be passed in either token0/token1 or token1/token0 order
  /// @param customDeployer The address of custom plugin deployer
  /// @param tokenA The contract address of either token0 or token1
  /// @param tokenB The contract address of the other token
  /// @return customPool The pool address
  function customPoolByPair(address customDeployer, address tokenA, address tokenB) external view returns (address customPool);

  /// @notice returns keccak256 of AlgebraPool init bytecode.
  /// @dev the hash value changes with any change in the pool bytecode
  /// @return Keccak256 hash of AlgebraPool contract init bytecode
  function POOL_INIT_CODE_HASH() external view returns (bytes32);

  /// @return timestamp The timestamp of the beginning of the renounceOwnership process
  function renounceOwnershipStartTimestamp() external view returns (uint256 timestamp);

  /// @notice Creates a pool for the given two tokens
  /// @param tokenA One of the two tokens in the desired pool
  /// @param tokenB The other of the two tokens in the desired pool
  /// @param data Data for plugin creation
  /// @dev tokenA and tokenB may be passed in either order: token0/token1 or token1/token0.
  /// The call will revert if the pool already exists or the token arguments are invalid.
  /// @return pool The address of the newly created pool
  function createPool(address tokenA, address tokenB, bytes calldata data) external returns (address pool);

  /// @notice Creates a custom pool for the given two tokens using `deployer` contract
  /// @param deployer The address of plugin deployer, also used for custom pool address calculation
  /// @param creator The initiator of custom pool creation
  /// @param tokenA One of the two tokens in the desired pool
  /// @param tokenB The other of the two tokens in the desired pool
  /// @param data The additional data bytes
  /// @dev tokenA and tokenB may be passed in either order: token0/token1 or token1/token0.
  /// The call will revert if the pool already exists or the token arguments are invalid.
  /// @return customPool The address of the newly created custom pool
  function createCustomPool(
    address deployer,
    address creator,
    address tokenA,
    address tokenB,
    bytes calldata data
  ) external returns (address customPool);

  /// @dev updates default community fee for new pools
  /// @param newDefaultCommunityFee The new community fee, _must_ be <= MAX_COMMUNITY_FEE
  function setDefaultCommunityFee(uint16 newDefaultCommunityFee) external;

  /// @dev updates default fee for new pools
  /// @param newDefaultFee The new  fee, _must_ be <= MAX_DEFAULT_FEE
  function setDefaultFee(uint16 newDefaultFee) external;

  /// @dev updates default tickspacing for new pools
  /// @param newDefaultTickspacing The new tickspacing, _must_ be <= MAX_TICK_SPACING and >= MIN_TICK_SPACING
  function setDefaultTickspacing(int24 newDefaultTickspacing) external;

  /// @dev updates pluginFactory address
  /// @param newDefaultPluginFactory address of new plugin factory
  function setDefaultPluginFactory(address newDefaultPluginFactory) external;

  /// @dev updates vaultFactory address
  /// @param newVaultFactory address of new vault factory
  function setVaultFactory(address newVaultFactory) external;

  /// @notice Starts process of renounceOwnership. After that, a certain period
  /// of time must pass before the ownership renounce can be completed.
  function startRenounceOwnership() external;

  /// @notice Stops process of renounceOwnership and removes timer.
  function stopRenounceOwnership() external;
}
