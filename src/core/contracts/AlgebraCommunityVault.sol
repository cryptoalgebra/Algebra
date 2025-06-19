// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import './libraries/SafeTransfer.sol';
import './libraries/FullMath.sol';

import './interfaces/IAlgebraFactory.sol';
import './interfaces/vault/IAlgebraCommunityVault.sol';

/// @title Algebra community fee vault
/// @notice Community fee from pools is sent here, if it is enabled
/// @dev Role system is used to withdraw tokens
/// @dev Version: Algebra Integral 1.2.2
contract AlgebraCommunityVault is IAlgebraCommunityVault {
  /// @dev The role can be granted in AlgebraFactory
  bytes32 public constant COMMUNITY_FEE_WITHDRAWER_ROLE = keccak256('COMMUNITY_FEE_WITHDRAWER');
  /// @dev The role can be granted in AlgebraFactory
  bytes32 public constant COMMUNITY_FEE_VAULT_ADMINISTRATOR = keccak256('COMMUNITY_FEE_VAULT_ADMINISTRATOR');
  address private immutable factory;

  /// @notice Address to which community fees are sent from vault
  address public communityFeeReceiver;
  /// @notice The percentage of the protocol fee that Algebra will receive
  /// @dev Value in thousandths,i.e. 1e-3
  uint16 public algebraFee;
  /// @notice Represents whether there is a new Algebra fee proposal or not
  bool public hasNewAlgebraFeeProposal;
  /// @notice Suggested Algebra fee value
  uint16 public proposedNewAlgebraFee;
  /// @notice Address of recipient Algebra part of community fee
  address public algebraFeeReceiver;
  /// @notice Address of Algebra fee manager
  address public algebraFeeManager;
  address private _pendingAlgebraFeeManager;

  uint16 private constant ALGEBRA_FEE_DENOMINATOR = 1000;

  modifier onlyAdministrator() {
    require(IAlgebraFactory(factory).hasRoleOrOwner(COMMUNITY_FEE_VAULT_ADMINISTRATOR, msg.sender), 'only administrator');
    _;
  }

  modifier onlyWithdrawer() {
    require(msg.sender == algebraFeeManager || IAlgebraFactory(factory).hasRoleOrOwner(COMMUNITY_FEE_WITHDRAWER_ROLE, msg.sender), 'only withdrawer');
    _;
  }

  modifier onlyAlgebraFeeManager() {
    require(msg.sender == algebraFeeManager, 'only algebra fee manager');
    _;
  }

  constructor(address _factory, address _algebraFeeManager) {
    (factory, algebraFeeManager) = (_factory, _algebraFeeManager);
  }

  /// @inheritdoc IAlgebraCommunityVault
  function withdraw(address token, uint256 amount) external override onlyWithdrawer {
    (uint16 _algebraFee, address _algebraFeeReceiver, address _communityFeeReceiver) = _readAndVerifyWithdrawSettings();
    _withdraw(token, _communityFeeReceiver, amount, _algebraFee, _algebraFeeReceiver);
  }

  /// @inheritdoc IAlgebraCommunityVault
  function withdrawTokens(WithdrawTokensParams[] calldata params) external override onlyWithdrawer {
    uint256 paramsLength = params.length;
    (uint16 _algebraFee, address _algebraFeeReceiver, address _communityFeeReceiver) = _readAndVerifyWithdrawSettings();

    unchecked {
      for (uint256 i; i < paramsLength; ++i) _withdraw(params[i].token, _communityFeeReceiver, params[i].amount, _algebraFee, _algebraFeeReceiver);
    }
  }

  function _readAndVerifyWithdrawSettings() private view returns (uint16 _algebraFee, address _algebraFeeReceiver, address _communityFeeReceiver) {
    (_algebraFee, _algebraFeeReceiver, _communityFeeReceiver) = (algebraFee, algebraFeeReceiver, communityFeeReceiver);
    if (_algebraFee != 0) require(_algebraFeeReceiver != address(0), 'invalid algebra fee receiver');
    require(_communityFeeReceiver != address(0), 'invalid receiver');
  }

  function _withdraw(address token, address to, uint256 amount, uint16 _algebraFee, address _algebraFeeReceiver) private {
    uint256 withdrawAmount = amount;
    if (_algebraFee != 0) {
      uint256 algebraFeeAmount = FullMath.mulDivRoundingUp(withdrawAmount, _algebraFee, ALGEBRA_FEE_DENOMINATOR);
      withdrawAmount -= algebraFeeAmount;
      SafeTransfer.safeTransfer(token, _algebraFeeReceiver, algebraFeeAmount);
      emit AlgebraTokensWithdrawal(token, _algebraFeeReceiver, algebraFeeAmount);
    }

    SafeTransfer.safeTransfer(token, to, withdrawAmount);
    emit TokensWithdrawal(token, to, withdrawAmount);
  }

  // ### algebra factory owner permissioned actions ###

  /// @inheritdoc IAlgebraCommunityVault
  function acceptAlgebraFeeChangeProposal(uint16 newAlgebraFee) external override onlyAdministrator {
    require(hasNewAlgebraFeeProposal, 'not proposed');
    require(newAlgebraFee == proposedNewAlgebraFee, 'invalid new fee');

    // note that the new value will be used for previously accumulated tokens that have not yet been withdrawn
    algebraFee = newAlgebraFee;
    (proposedNewAlgebraFee, hasNewAlgebraFeeProposal) = (0, false);
    emit AlgebraFee(newAlgebraFee);
  }

  /// @inheritdoc IAlgebraCommunityVault
  function changeCommunityFeeReceiver(address newCommunityFeeReceiver) external override onlyAdministrator {
    require(newCommunityFeeReceiver != address(0));
    require(newCommunityFeeReceiver != communityFeeReceiver);
    communityFeeReceiver = newCommunityFeeReceiver;
    emit CommunityFeeReceiver(newCommunityFeeReceiver);
  }

  // ### algebra fee manager permissioned actions ###

  /// @inheritdoc IAlgebraCommunityVault
  function transferAlgebraFeeManagerRole(address _newAlgebraFeeManager) external override onlyAlgebraFeeManager {
    _pendingAlgebraFeeManager = _newAlgebraFeeManager;
    emit PendingAlgebraFeeManager(_newAlgebraFeeManager);
  }

  /// @inheritdoc IAlgebraCommunityVault
  function acceptAlgebraFeeManagerRole() external override {
    require(msg.sender == _pendingAlgebraFeeManager);
    (_pendingAlgebraFeeManager, algebraFeeManager) = (address(0), msg.sender);
    emit AlgebraFeeManager(msg.sender);
  }

  /// @inheritdoc IAlgebraCommunityVault
  function proposeAlgebraFeeChange(uint16 newAlgebraFee) external override onlyAlgebraFeeManager {
    require(newAlgebraFee <= ALGEBRA_FEE_DENOMINATOR);
    require(newAlgebraFee != proposedNewAlgebraFee && newAlgebraFee != algebraFee);
    (proposedNewAlgebraFee, hasNewAlgebraFeeProposal) = (newAlgebraFee, true);
    emit AlgebraFeeProposal(newAlgebraFee);
  }

  /// @inheritdoc IAlgebraCommunityVault
  function cancelAlgebraFeeChangeProposal() external override onlyAlgebraFeeManager {
    (proposedNewAlgebraFee, hasNewAlgebraFeeProposal) = (0, false);
    emit CancelAlgebraFeeProposal();
  }

  /// @inheritdoc IAlgebraCommunityVault
  function changeAlgebraFeeReceiver(address newAlgebraFeeReceiver) external override onlyAlgebraFeeManager {
    require(newAlgebraFeeReceiver != address(0));
    require(newAlgebraFeeReceiver != algebraFeeReceiver);
    algebraFeeReceiver = newAlgebraFeeReceiver;
    emit AlgebraFeeReceiver(newAlgebraFeeReceiver);
  }
}
