// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;
pragma abicoder v2;

import '../../base/AlgebraFeeConfiguration.sol';

/// @title The interface for the Algebra dynamic fee manager
/// @dev This contract calculates adaptive fee
interface IDynamicFeeManager {
  /// @notice Emitted when the fee configuration is changed
  /// @param feeConfig The structure with dynamic fee parameters
  /// @dev See the AdaptiveFee struct for more details
  event FeeConfiguration(AlgebraFeeConfiguration feeConfig);

  /// @notice Changes fee configuration for the pool
  function changeFeeConfiguration(AlgebraFeeConfiguration calldata feeConfig) external;

  // TODO
  function getCurrentFee() external view returns (uint16 fee);
}
