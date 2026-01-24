// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

import '@cryptoalgebra/integral-core/contracts/interfaces/plugin/IAlgebraPluginFactory.sol';
import '@cryptoalgebra/abstract-plugin/contracts/interfaces/IBasePluginFactory.sol';

/// @title Interface for FeeAuctionPluginFactory
/// @notice Factory that creates FeeAuctionPlugin instances for Algebra pools
interface IFeeAuctionPluginFactory is IAlgebraPluginFactory, IBasePluginFactory {
  /// @notice Emitted when default MEV tax parameters are changed
  /// @param mevTaxMultiplier New default multiplier for priority fee
  /// @param maxMevTax New default maximum MEV tax
  event DefaultMevTaxParametersChanged(uint256 mevTaxMultiplier, uint24 maxMevTax);

  /// @notice Emitted when default base fee is changed
  /// @param baseFee New default base fee
  event DefaultBaseFeeChanged(uint24 baseFee);

  /// @notice Emitted when default MEV tax enabled status is changed
  /// @param enabled New default MEV tax enabled status
  event DefaultMevTaxEnabledChanged(bool enabled);

  /// @notice Returns the administrator role hash
  /// @return The keccak256 hash of the administrator role
  function ALGEBRA_FEE_AUCTION_PLUGIN_FACTORY_ADMINISTRATOR() external view returns (bytes32);

  /// @notice Returns the default MEV tax multiplier
  /// @return Default multiplier applied to priority fee
  function defaultMevTaxMultiplier() external view returns (uint256);

  /// @notice Returns the default maximum MEV tax
  /// @return Default maximum MEV tax in basis points
  function defaultMaxMevTax() external view returns (uint24);

  /// @notice Returns the default base fee
  /// @return Default base fee in basis points
  function defaultBaseFee() external view returns (uint24);

  /// @notice Returns the default MEV tax enabled status
  /// @return True if MEV tax is enabled by default
  function defaultMevTaxEnabled() external view returns (bool);

  /// @notice Sets the default MEV tax parameters for new plugins
  /// @dev Can only be called by administrator
  /// @param newMevTaxMultiplier New default multiplier for priority fee
  /// @param newMaxMevTax New default maximum MEV tax
  function setDefaultMevTaxParameters(uint256 newMevTaxMultiplier, uint24 newMaxMevTax) external;

  /// @notice Sets the default base fee for new plugins
  /// @dev Can only be called by administrator
  /// @param newBaseFee New default base fee
  function setDefaultBaseFee(uint24 newBaseFee) external;

  /// @notice Sets the default MEV tax enabled status for new plugins
  /// @dev Can only be called by administrator
  /// @param enabled New default MEV tax enabled status
  function setDefaultMevTaxEnabled(bool enabled) external;
}
