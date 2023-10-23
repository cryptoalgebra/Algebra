// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title Permissioned pool actions
/// @notice Contains pool methods that may only be called by permissioned addresses
/// @dev Credit to Uniswap Labs under GPL-2.0-or-later license:
/// https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces
interface IAlgebraPoolPermissionedActions {
  /// @notice Set the community's % share of the fees. Only factory owner or POOLS_ADMINISTRATOR_ROLE role
  /// @param newCommunityFee The new community fee percent in thousandths (1e-3)
  function setCommunityFee(uint16 newCommunityFee) external;

  /// @notice Set the new tick spacing values. Only factory owner or POOLS_ADMINISTRATOR_ROLE role
  /// @param newTickSpacing The new tick spacing value
  function setTickSpacing(int24 newTickSpacing) external;

  /// @notice Set the new plugin address. Only factory owner or POOLS_ADMINISTRATOR_ROLE role
  /// @param newPluginAddress The new plugin address
  function setPlugin(address newPluginAddress) external;

  /// @notice Set new plugin config
  /// @param newConfig In the new configuration of the plugin,
  /// each bit of which is responsible for a particular hook.
  /// Only factory owner or POOLS_ADMINISTRATOR_ROLE role
  function setPluginConfig(uint8 newConfig) external;

  /// @notice Set new pool fee. Can be called by owner if dynamic fee is disabled.
  /// Called by the plugin if dynamic fee is enabled
  /// @param newFee The new fee value
  function setFee(uint16 newFee) external;
}
