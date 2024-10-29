// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;
pragma abicoder v2;

/// @title The interface for the AlgebraLimitOrderPlugin
interface IAlgebraLimitOrderPlugin {
  /// @notice Initialize the plugin externally
  /// @dev This function allows to initialize the plugin if it was created after the pool was created
  function setLimitOrderPlugin(address newPlugin) external;

  event LimitOrderPlugin(address newPlugin);
}
