// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title The interface for the Algebra farming plugin
/// @dev This contract used for virtual pools in farms
interface IFarmingPlugin {
  /// @notice Emitted when new activeIncentive is set
  /// @param newIncentive The address of the new incentive
  event Incentive(address newIncentive);

  /// @notice Returns the address of the pool the plugin is created for
  /// @return address of the pool
  function pool() external view returns (address);

  /// @notice Connects or disconnects an incentive.
  /// @dev Only farming can connect incentives.
  /// The one who connected it and the current farming has the right to disconnect the incentive.
  /// @param newIncentive The address associated with the incentive or zero address
  function setIncentive(address newIncentive) external;

  /// @notice Checks if the incentive is connected to pool
  /// @dev Returns false if the plugin has a different incentive set, the plugin is not connected to the pool,
  /// or the plugin configuration is incorrect.
  /// @param targetIncentive The address of the incentive to be checked
  /// @return Indicates whether the target incentive is active
  function isIncentiveConnected(address targetIncentive) external view returns (bool);

  /// @notice Returns the address of active incentive
  /// @dev if there is no active incentive at the moment, incentiveAddress would be equal to address(0)
  /// @return  The address associated with the current active incentive
  function incentive() external view returns (address);
}
