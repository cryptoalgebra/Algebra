// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import './interfaces/IAlgebraFactory.sol';
import './libraries/SafeTransfer.sol';

/// @title Algebra community fee vault
/// @notice Community fee from pools is sent here, if it is enabled
contract AlgebraCommunityVault {
  event TokensWithdrawal(address indexed token, address indexed to, uint256 amount);

  /// @dev The role can be granted in AlgebraFactory
  bytes32 public constant COMMUNITY_FEE_WITHDRAWER_ROLE = keccak256('COMMUNITY_FEE_WITHDRAWER');
  address private immutable factory;

  modifier onlyWithdrawer() {
    require(IAlgebraFactory(factory).hasRoleOrOwner(COMMUNITY_FEE_WITHDRAWER_ROLE, msg.sender));
    _;
  }

  constructor() {
    factory = msg.sender;
  }

  function withdraw(address token, address to, uint256 amount) external onlyWithdrawer {
    _withdraw(token, to, amount);
  }

  struct WithdrawTokensParams {
    address token;
    address to;
    uint256 amount;
  }

  function withdrawTokens(WithdrawTokensParams[] calldata params) external onlyWithdrawer {
    uint256 paramsLength = params.length;
    unchecked {
      for (uint256 i; i < paramsLength; ++i) _withdraw(params[i].token, params[i].to, params[i].amount);
    }
  }

  function _withdraw(address token, address to, uint256 amount) private {
    SafeTransfer.safeTransfer(token, to, amount);
    emit TokensWithdrawal(token, to, amount);
  }
}
