// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title The interface for the Algebra community fee vault
/// @notice Community fee from pools is sent here, if it is enabled
/// @dev Version: Algebra Integral
interface IAlgebraVault {
  /// @notice Event emitted when a fees has been claimed
  /// @param token The address of token fee
  /// @param to The address where claimed rewards were sent to
  /// @param amount The amount of fees tokens claimed by communityFeeReceiver
  event TokensWithdrawal(address indexed token, address indexed to, uint256 amount);

  /// @notice Withdraw protocol fees from vault
  /// @dev Can only be called by algebraFeeManager or communityFeeReceiver
  /// @param token The token address
  /// @param to The receiver address
  /// @param amount The amount of token
  function withdrawTo(address token, address to, uint256 amount) external;

  struct WithdrawTokensParams {
    address token;
    address to;
    uint256 amount;
  }

  /// @notice Withdraw protocol fees from vault. Used to claim fees for multiple tokens
  /// @dev Can be called by algebraFeeManager or communityFeeReceiver
  /// @param params Array of WithdrawTokensParams objects containing token addresses, receiver address and amounts to withdraw
  function withdrawTokensTo(WithdrawTokensParams[] calldata params) external;
}
