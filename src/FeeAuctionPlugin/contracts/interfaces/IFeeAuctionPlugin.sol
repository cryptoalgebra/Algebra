// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

import '@cryptoalgebra/abstract-plugin/contracts/interfaces/IAbstractPlugin.sol';

/// @title Interface for FeeAuctionPlugin
/// @notice Plugin that implements MEV tax - a fee that depends on transaction priority fee
/// @dev Allows protocol to capture MEV instead of sequencers on L2 chains
interface IFeeAuctionPlugin is IAbstractPlugin {
  /// @notice Emitted when MEV tax parameters are changed
  /// @param mevTaxMultiplier New multiplier for priority fee
  /// @param maxMevTax Maximum MEV tax in basis points
  event MevTaxParametersChanged(uint256 mevTaxMultiplier, uint24 maxMevTax);

  /// @notice Emitted when base fee is changed
  /// @param baseFee New base fee in basis points
  event BaseFeeChanged(uint24 baseFee);

  /// @notice Emitted when MEV tax is enabled or disabled
  /// @param enabled Whether MEV tax is enabled
  event MevTaxEnabledChanged(bool enabled);

  /// @notice Returns the current base fee
  /// @return Base fee in basis points (100 = 0.01%)
  function baseFee() external view returns (uint24);

  /// @notice Returns the MEV tax multiplier
  /// @dev mevTax = (priorityFee * mevTaxMultiplier) / 1e9
  /// @return Multiplier applied to priority fee
  function mevTaxMultiplier() external view returns (uint256);

  /// @notice Returns the maximum MEV tax
  /// @return Maximum MEV tax in basis points
  function maxMevTax() external view returns (uint24);

  /// @notice Returns whether MEV tax is enabled
  /// @return True if MEV tax is enabled
  function mevTaxEnabled() external view returns (bool);

  /// @notice Sets the base fee for swaps
  /// @dev Can only be called by administrator
  /// @param newBaseFee New base fee in basis points
  function setBaseFee(uint24 newBaseFee) external;

  /// @notice Sets MEV tax parameters
  /// @dev Can only be called by administrator
  /// @param newMevTaxMultiplier New multiplier for priority fee
  /// @param newMaxMevTax New maximum MEV tax in basis points
  function setMevTaxParameters(uint256 newMevTaxMultiplier, uint24 newMaxMevTax) external;

  /// @notice Enables or disables MEV tax
  /// @dev Can only be called by administrator
  /// @param enabled Whether to enable MEV tax
  function setMevTaxEnabled(bool enabled) external;
}
