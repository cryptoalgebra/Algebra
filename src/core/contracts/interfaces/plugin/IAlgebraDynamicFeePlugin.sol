// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title The interface for the Algebra plugin with dynamic fee logic
/// @dev A plugin with a dynamic fee must implement this interface so that the current fee can be known through the pool
/// If the dynamic fee logic does not allow the fee to be calculated without additional data, the method should revert with the appropriate message
interface IAlgebraDynamicFeePlugin {
  /// @notice Returns fee from plugin
  /// @return fee The pool fee value in hundredths of a bip, i.e. 1e-6
  function getCurrentFee() external view returns (uint16 fee);
}
