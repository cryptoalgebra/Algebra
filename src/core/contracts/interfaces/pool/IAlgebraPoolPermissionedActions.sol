// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title Permissioned pool actions
/// @notice Contains pool methods that may only be called by permissioned addresses
/// @dev Credit to Uniswap Labs under GPL-2.0-or-later license:
/// https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces
interface IAlgebraPoolPermissionedActions {
  /// @notice Set the community's % share of the fees. Only factory owner or POOLS_ADMINISTRATOR_ROLE role
  /// @param communityFee new community fee percent in thousandths (1e-3)
  function setCommunityFee(uint16 communityFee) external;

  /// @notice Set the new tick spacing values. Only factory owner or POOLS_ADMINISTRATOR_ROLE role
  /// @param newTickSpacing The new tick spacing value
  function setTickSpacing(int24 newTickSpacing) external;

  // TODO
  function setPlugin(address newPluginAddress) external;

  // TODO
  function setFee(uint16 newFee) external;
}
