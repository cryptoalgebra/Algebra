// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;
pragma abicoder v2;

import '@cryptoalgebra/integral-core/contracts/interfaces/plugin/IAlgebraPluginFactory.sol';

/// @title The interface for the BasePluginV2Factory
/// @notice This contract creates Algebra default plugins for Algebra liquidity pools
interface IBasePluginV2Factory is IAlgebraPluginFactory {
  /// @notice Emitted when the farming address is changed
  /// @param newFarmingAddress The farming address after the address was changed
  event FarmingAddress(address newFarmingAddress);

  event DefaultBaseFee(uint16 newDefaultBaseFee);

  /// @notice The hash of 'ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR' used as role
  /// @dev allows to change settings of BasePluginV2Factory
  function ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR() external pure returns (bytes32);

  /// @notice Returns the address of AlgebraFactory
  /// @return The AlgebraFactory contract address
  function algebraFactory() external view returns (address);

  /// @notice Returns current farming address
  /// @return The farming contract address
  function farmingAddress() external view returns (address);

  function defaultBaseFee() external view returns (uint16);

  /// @notice Returns address of plugin created for given AlgebraPool
  /// @param pool The address of AlgebraPool
  /// @return The address of corresponding plugin
  function pluginByPool(address pool) external view returns (address);

  /// @notice Create plugin for already existing pool
  /// @param token0 The address of first token in pool
  /// @param token1 The address of second token in pool
  /// @return The address of created plugin
  function createPluginForExistingPool(address token0, address token1) external returns (address);

  /// @dev updates farmings manager address on the factory
  /// @param newFarmingAddress The new tokenomics contract address
  function setFarmingAddress(address newFarmingAddress) external;

  function setDefaultBaseFee(uint16 newDefaultBaseFee) external;
}
