// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;
pragma abicoder v2;

import '@cryptoalgebra/integral-core/contracts/interfaces/plugin/IAlgebraDynamicFeePlugin.sol';
import '../../base/AlgebraFeeConfiguration.sol';

/// @title The interface for the Algebra dynamic fee manager
/// @dev This contract calculates adaptive fee
interface IDynamicFeeManager is IAlgebraDynamicFeePlugin {
  /// @notice Emitted when the fee configuration is changed
  /// @param feeConfig The structure with dynamic fee parameters
  /// @dev See the AdaptiveFee struct for more details
  event FeeConfiguration(AlgebraFeeConfiguration feeConfig);

  /// @notice Returns address of oracle module
  /// @return Address of oracle module, which is connected to the same pool
  function oracleModule() external view returns (address);

  /// @notice Returns address of AlgebraFactory
  /// @return Address of AlgebraFactory
  function factory() external view returns (address);

  /// @notice Returns address of plugin factory (BasePluginV1Factory now)
  /// @return Address of plugin factory
  function pluginFactory() external view returns (address);

  /// @notice Current dynamic fee configuration
  /// @dev See the AdaptiveFee struct for more details
  function feeConfig() external view returns (uint16 alpha1, uint16 alpha2, uint32 beta1, uint32 beta2, uint16 gamma1, uint16 gamma2, uint16 baseFee);

  /// @notice Changes fee configuration for the pool
  function changeFeeConfiguration(AlgebraFeeConfiguration calldata feeConfig) external;
}
