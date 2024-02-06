// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title The interface for the Algebra community fee vault
/// @notice Community fee from pools is sent here, if it is enabled
/// @dev Version: Algebra Integral
interface IAlgebraCommunityVault {
  /// @notice Event emitted when a fees has been claimed
  /// @param token The address of token fee
  /// @param to The address where claimed rewards were sent to
  /// @param amount The amount of fees tokens claimed by communityFeeReceiver
  event TokensWithdrawal(address indexed token, address indexed to, uint256 amount);

  /// @notice Event emitted when a fees has been claimed
  /// @param token The address of token fee
  /// @param to The address where claimed rewards were sent to
  /// @param amount The amount of fees tokens claimed by Algebra
  event AlgebraTokensWithdrawal(address indexed token, address indexed to, uint256 amount);

  /// @notice Emitted when a AlgebraFeeReceiver address changed
  /// @param newAlgebraFeeReceiver New Algebra fee receiver address
  event AlgebraFeeReceiver(address newAlgebraFeeReceiver);

  /// @notice Emitted when a AlgebraFeeManager address change proposed
  /// @param pendingAlgebraFeeManager New pending Algebra fee manager address
  event PendingAlgebraFeeManager(address pendingAlgebraFeeManager);

  /// @notice Emitted when a new Algebra fee value proposed
  /// @param proposedNewAlgebraFee The new proposed Algebra fee value
  event AlgebraFeeProposal(uint16 proposedNewAlgebraFee);

  /// @notice Emitted when a Algebra fee proposal canceled
  event CancelAlgebraFeeProposal();

  /// @notice Emitted when a AlgebraFeeManager address changed
  /// @param newAlgebraFeeManager New Algebra fee manager address
  event AlgebraFeeManager(address newAlgebraFeeManager);

  /// @notice Emitted when the Algebra fee is changed
  /// @param newAlgebraFee The new Algebra fee value
  event AlgebraFee(uint16 newAlgebraFee);

  /// @notice Emitted when a CommunityFeeReceiver address changed
  /// @param newCommunityFeeReceiver New fee receiver address
  event CommunityFeeReceiver(address newCommunityFeeReceiver);

  /// @notice Withdraw protocol fees from vault
  /// @dev Can only be called by algebraFeeManager or communityFeeReceiver
  /// @param token The token address
  /// @param amount The amount of token
  function withdraw(address token, uint256 amount) external;

  struct WithdrawTokensParams {
    address token;
    uint256 amount;
  }

  /// @notice Withdraw protocol fees from vault. Used to claim fees for multiple tokens
  /// @dev Can be called by algebraFeeManager or communityFeeReceiver
  /// @param params Array of WithdrawTokensParams objects containing token addresses and amounts to withdraw
  function withdrawTokens(WithdrawTokensParams[] calldata params) external;

  // ### algebra factory owner permissioned actions ###

  /// @notice Accepts the proposed new Algebra fee
  /// @dev Can only be called by the factory owner.
  /// The new value will also be used for previously accumulated tokens that have not yet been withdrawn
  /// @param newAlgebraFee New Algebra fee value
  function acceptAlgebraFeeChangeProposal(uint16 newAlgebraFee) external;

  /// @notice Change community fee receiver address
  /// @dev Can only be called by the factory owner
  /// @param newCommunityFeeReceiver New community fee receiver address
  function changeCommunityFeeReceiver(address newCommunityFeeReceiver) external;

  // ### algebra fee manager permissioned actions ###

  /// @notice Transfers Algebra fee manager role
  /// @param _newAlgebraFeeManager new Algebra fee manager address
  function transferAlgebraFeeManagerRole(address _newAlgebraFeeManager) external;

  /// @notice accept Algebra FeeManager role
  function acceptAlgebraFeeManagerRole() external;

  /// @notice Proposes new Algebra fee value for protocol
  /// @dev the new value will also be used for previously accumulated tokens that have not yet been withdrawn
  /// @param newAlgebraFee new Algebra fee value
  function proposeAlgebraFeeChange(uint16 newAlgebraFee) external;

  /// @notice Cancels Algebra fee change proposal
  function cancelAlgebraFeeChangeProposal() external;

  /// @notice Change Algebra community fee part receiver
  /// @param newAlgebraFeeReceiver The address of new Algebra fee receiver
  function changeAlgebraFeeReceiver(address newAlgebraFeeReceiver) external;
}
