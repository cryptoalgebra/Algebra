// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;
pragma abicoder v2;

/// @title The interface for the Algebra plugin with dynamic fee logic
interface IAlgebraDynamicFeePlugin {
  /// @notice Returns fee from plugin
  /// @return fee pool fee value in hundredths of a bip, i.e. 1e-6
  function getCurrentFee() external view returns (uint16 fee);
}
