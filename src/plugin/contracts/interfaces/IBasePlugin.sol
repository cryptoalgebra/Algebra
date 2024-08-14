// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;
pragma abicoder v2;

import '@cryptoalgebra/integral-core/contracts/interfaces/plugin/IAlgebraPlugin.sol';

/// @title The interface for the BasePlugin
interface IBasePlugin is IAlgebraPlugin {
  /// @notice Claim plugin fee
  /// @param token The token address
  /// @param amount Amount of tokens
  /// @param recipient Recipient address
  function collectPluginFee(address token, uint256 amount, address recipient) external;

  /// @notice Returns the address of the pool the plugin is created for
  /// @return address of the pool
  function pool() external view returns (address);
}
