// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import './libraries/SafeTransfer.sol';

import './interfaces/IAlgebraVault.sol';
import './interfaces/IAlgebraFactory.sol';

/// @title Algebra community fee vault
/// @notice Community fee from pools is sent here, if it is enabled
/// @dev Role system is used to withdraw tokens
/// @dev Version: Algebra Integral
contract AlgebraVault is IAlgebraVault {
  /// @dev The role can be granted in AlgebraFactory
  bytes32 public constant COMMUNITY_FEE_WITHDRAWER_ROLE = keccak256('COMMUNITY_FEE_WITHDRAWER');

  address private immutable factory;

  modifier onlyWithdrawer() {
    require(IAlgebraFactory(factory).hasRoleOrOwner(COMMUNITY_FEE_WITHDRAWER_ROLE, msg.sender), 'only withdrawer');
    _;
  }

  constructor(address _factory) {
    factory = _factory;
  }

  /// @inheritdoc IAlgebraVault
  function withdrawTo(address token, address to, uint256 amount) external override onlyWithdrawer {
    _withdraw(token, to, amount);
  }

  /// @inheritdoc IAlgebraVault
  function withdrawTokensTo(WithdrawTokensParams[] calldata params) external override onlyWithdrawer {
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
