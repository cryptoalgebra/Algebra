// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import './libraries/SafeTransfer.sol';

import './interfaces/IAlgebraFactory.sol';
import './interfaces/vault/IAlgebraCommunityVault.sol';

/// @title Algebra community fee vault
/// @notice Community fee from pools is sent here, if it is enabled
/// @dev Role system is used to withdraw tokens
/// @dev Version: Algebra Integral 1.3
contract AlgebraCommunityVault is IAlgebraCommunityVault {
  /// @dev The role can be granted in AlgebraFactory
  bytes32 public constant COMMUNITY_FEE_WITHDRAWER_ROLE = keccak256('COMMUNITY_FEE_WITHDRAWER');
  /// @dev The role can be granted in AlgebraFactory
  bytes32 public constant COMMUNITY_FEE_VAULT_ADMINISTRATOR = keccak256('COMMUNITY_FEE_VAULT_ADMINISTRATOR');
  address private immutable factory;

  /// @notice Address to which community fees are sent from vault
  address public communityFeeReceiver;

  modifier onlyAdministrator() {
    require(IAlgebraFactory(factory).hasRoleOrOwner(COMMUNITY_FEE_VAULT_ADMINISTRATOR, msg.sender), 'only administrator');
    _;
  }

  modifier onlyWithdrawer() {
    require(IAlgebraFactory(factory).hasRoleOrOwner(COMMUNITY_FEE_WITHDRAWER_ROLE, msg.sender), 'only withdrawer');
    _;
  }

  constructor(address _factory) {
    factory = _factory;
  }

  /// @inheritdoc IAlgebraCommunityVault
  function withdraw(address token, uint256 amount) external override onlyWithdrawer {
    require(communityFeeReceiver != address(0), 'invalid receiver');
    SafeTransfer.safeTransfer(token, communityFeeReceiver, amount);
    emit TokensWithdrawal(token, communityFeeReceiver, amount);
  }

  /// @inheritdoc IAlgebraCommunityVault
  function withdrawTokens(WithdrawTokensParams[] calldata params) external override onlyWithdrawer {
    address _communityFeeReceiver = communityFeeReceiver;
    require(_communityFeeReceiver != address(0), 'invalid receiver');
    uint256 paramsLength = params.length;
    unchecked {
      for (uint256 i; i < paramsLength; ++i) {
        SafeTransfer.safeTransfer(params[i].token, _communityFeeReceiver, params[i].amount);
        emit TokensWithdrawal(params[i].token, _communityFeeReceiver, params[i].amount);
      }
    }
  }

  /// @inheritdoc IAlgebraCommunityVault
  function changeCommunityFeeReceiver(address newCommunityFeeReceiver) external override onlyAdministrator {
    require(newCommunityFeeReceiver != address(0));
    require(newCommunityFeeReceiver != communityFeeReceiver);
    communityFeeReceiver = newCommunityFeeReceiver;
    emit CommunityFeeReceiver(newCommunityFeeReceiver);
  }

  /// @inheritdoc IAlgebraCommunityVaultFeeHandler
  // Can be extended in derived contracts if additional logic is needed
  function handleCommunityFee(address, address, uint256, uint256) external override {
    // solhint-disable-next-line no-empty-blocks
  }
}
