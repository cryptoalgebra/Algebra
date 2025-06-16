// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;
pragma abicoder v2;

import '@cryptoalgebra/integral-core/contracts/interfaces/plugin/IAlgebraPluginFactory.sol';

import '../base/AlgebraFeeConfiguration.sol';

/// @title The interface for the HydrexBasePluginFactory
/// @notice This contract creates Algebra base plugins for Algebra liquidity pools
interface IHydrexBasePluginFactory is IAlgebraPluginFactory {
  /// @notice Emitted when the default fee configuration is changed
  /// @param newConfig The structure with dynamic fee parameters
  /// @dev See the AdaptiveFee library for more details
  event DefaultFeeConfiguration(AlgebraFeeConfiguration newConfig);

  event DefaultBaseFee(uint16 newDefaultBaseFee);
  
  /// @notice Emitted when the dynamic fee status is changed
  /// @param isEnabled Dynamic fee new status
  event DynamicFeeStatus(bool isEnabled);

  /// @notice Emitted when the sliding fee status is changed
  /// @param isEnabled Sliding fee new status
  event SlidingFeeStatus(bool isEnabled);

  /// @notice Emitted when the security registry address is changed
  /// @param securityRegistry The security registry address after the address was changed
  event SecurityRegistry(address securityRegistry);

  /// @notice Emitted when the farming address is changed
  /// @param newFarmingAddress The farming address after the address was changed
  event FarmingAddress(address newFarmingAddress);

  /// @notice The hash of 'ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR' used as role
  /// @dev allows to change settings of BasePluginV1Factory
  function ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR() external pure returns (bytes32);

  /// @notice Returns the address of AlgebraFactory
  /// @return The AlgebraFactory contract address
  function algebraFactory() external view returns (address);

  /// @notice Returns current farming address
  /// @return The farming contract address
  function farmingAddress() external view returns (address);

  function defaultBaseFee() external view returns (uint16);

  /// @notice Returns the status of the sliding fee
  /// @return The status of the sliding fee
  function slidingFeeStatus() external view returns (bool);

  /// @notice Returns the status of the dynamic fee
  /// @return The status of the dynamic fee
  function dynamicFeeStatus() external view returns (bool);

  /// @notice Returns current securityRegistry address
  /// @return The securityRegistry contract address
  function securityRegistry() external view returns (address);

  /// @notice Current default dynamic fee configuration
  /// @dev See the AdaptiveFee struct for more details about params.
  /// This value is set by default in new plugins
  function defaultFeeConfiguration()
    external
    view
    returns (uint16 alpha1, uint16 alpha2, uint32 beta1, uint32 beta2, uint16 gamma1, uint16 gamma2, uint16 baseFee);

  /// @notice Returns address of plugin created for given AlgebraPool
  /// @param pool The address of AlgebraPool
  /// @return The address of corresponding plugin
  function pluginByPool(address pool) external view returns (address);

  /// @notice Create plugin for already existing pool
  /// @param token0 The address of first token in pool
  /// @param token1 The address of second token in pool
  /// @return The address of created plugin
  function createPluginForExistingPool(address token0, address token1) external returns (address);

  /// @notice Changes initial fee configuration for new pools
  /// @dev changes coefficients for sigmoids: α / (1 + e^( (β-x) / γ))
  /// alpha1 + alpha2 + baseFee (max possible fee) must be <= type(uint16).max and gammas must be > 0
  /// @param newConfig new default fee configuration. See the #AdaptiveFee.sol library for details
  function setDefaultFeeConfiguration(AlgebraFeeConfiguration calldata newConfig) external;

  /// @notice Changes dynamic fee status
  /// @param status New status of dynamic fee
  function setDynamicFeeStatus(bool status) external;

  /// @notice Changes sliding fee status
  /// @param status New status of sliding fee
  function setSlidingFeeStatus(bool status) external;

  /// @dev updates securoty registry address on the factory
  /// @param newSecurityRegistry The new security registry contract address
  function setSecurityRegistry(address newSecurityRegistry) external;

  function setDefaultBaseFee(uint16 newDefaultBaseFee) external;

  /// @dev updates farmings manager address on the factory
  /// @param newFarmingAddress The new tokenomics contract address
  function setFarmingAddress(address newFarmingAddress) external;
}
