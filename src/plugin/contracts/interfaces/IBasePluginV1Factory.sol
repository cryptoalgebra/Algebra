// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;
pragma abicoder v2;

import '@cryptoalgebra/integral-core/contracts/interfaces/plugin/IAlgebraPluginFactory.sol';

import '../base/AlgebraFeeConfiguration.sol';

/// @title The interface for the BasePluginV1Factory
/// @notice This contract creates Algebra default plugins for Algebra liquidity pools
interface IBasePluginV1Factory is IAlgebraPluginFactory {
  /// @notice Emitted when the default fee configuration is changed
  /// @param newConfig The structure with dynamic fee parameters
  /// @dev See the AdaptiveFee library for more details
  event DefaultFeeConfiguration(AlgebraFeeConfiguration newConfig);

  /// @notice Emitted when the farming address is changed
  /// @param newFarmingAddress The farming address after the address was changed
  event FarmingAddress(address newFarmingAddress);

  /// @notice Emitted when the entrypoint address is added
  /// @param entrypoint The entrypoint address that was added
  event AddModifyLiquidityEntrypoint(address entrypoint);

  /// @notice Emitted when the entrypoint address is removed
  /// @param entrypoint The entrypoint address that was removed
  event RemoveModifyLiquidityEntrypoint(address entrypoint);

  /// @notice The hash of 'ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR' used as role
  /// @dev allows to change settings of BasePluginV1Factory
  function ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR() external pure returns (bytes32);

  /// @notice Returns the address of AlgebraFactory
  /// @return The AlgebraFactory contract address
  function algebraFactory() external view returns (address);

  /// @notice Returns the status of entrypoint contract
  /// @param modifyLiqudityEntryPoint The address of entrypoint
  /// @return isEnabled Entrypoint status
  function modifyLiquidityEntryPointsStatuses(address modifyLiqudityEntryPoint) external view returns (bool isEnabled);

  /// @notice Current default dynamic fee configuration
  /// @dev See the AdaptiveFee struct for more details about params.
  /// This value is set by default in new plugins
  function defaultFeeConfiguration()
    external
    view
    returns (uint16 alpha1, uint16 alpha2, uint32 beta1, uint32 beta2, uint16 gamma1, uint16 gamma2, uint16 baseFee);

  /// @notice Returns current farming address
  /// @return The farming contract address
  function farmingAddress() external view returns (address);

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

  /// @dev updates farmings manager address on the factory
  /// @param newFarmingAddress The new tokenomics contract address
  function setFarmingAddress(address newFarmingAddress) external;

  /// @notice Adds entrypoint contract
  /// @param entrypoint The address of entrypoint
  /// @dev Only admin can add entrypoint
  function addModifyLiquidityEntrypoint(address entrypoint) external;

  /// @notice Removes entrypoint contract
  /// @param entrypoint The address of entrypoint
  /// @dev Only admin can remove entrypoint
  function removeModifyLiquidityEntrypoint(address entrypoint) external;
}
