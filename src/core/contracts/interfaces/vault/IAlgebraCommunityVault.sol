// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title The interface for the Algebra community fee vault
/// @notice Community fee from pools is claimed here, if it is enabled
/// @dev Version: Algebra Integral
interface IAlgebraCommunityVault {
  /// @notice Event emitted when a fees has been claimed
  /// @param token The address of token fee
  /// @param to The address where claimed rewards were sent to
  /// @param amount The amount of fees tokens claimed by communityFeeReceiver
  event TokensWithdrawal(address indexed token, address indexed to, uint256 amount);

  /// @notice Emitted when a CommunityFeeReceiver address changed
  /// @param newCommunityFeeReceiver New fee receiver address
  event CommunityFeeReceiver(address newCommunityFeeReceiver);

  /// @notice Claims the accumulated community fees from pools to this vault
  /// @dev Anyone can call it, the fees can only be sent to this vault
  /// @param pools The pools to claim from, each must have this vault set as the community vault
  function claimCommunityFees(address[] calldata pools) external;

  /// @notice Withdraw protocol fees from vault
  /// @param token The token address
  /// @param amount The amount of token
  function withdraw(address token, uint256 amount) external;

  struct WithdrawTokensParams {
    address token;
    uint256 amount;
  }

  /// @notice Withdraw protocol fees from vault. Used to claim fees for multiple tokens
  /// @param params Array of WithdrawTokensParams objects containing token addresses and amounts to withdraw
  function withdrawTokens(WithdrawTokensParams[] calldata params) external;

  /// @notice Change community fee receiver address
  /// @param newCommunityFeeReceiver New community fee receiver address
  function changeCommunityFeeReceiver(address newCommunityFeeReceiver) external;
}
