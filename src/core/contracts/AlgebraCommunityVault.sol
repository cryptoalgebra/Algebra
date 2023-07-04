// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import './libraries/SafeTransfer.sol';
import './libraries/FullMath.sol';

import './interfaces/IAlgebraFactory.sol';

// TODO natspecs
// TODO events

/// @title Algebra community fee vault
/// @notice Community fee from pools is sent here, if it is enabled
contract AlgebraCommunityVault {
  event TokensWithdrawal(address indexed token, address indexed to, uint256 amount);

  /// @dev The role can be granted in AlgebraFactory
  bytes32 public constant COMMUNITY_FEE_WITHDRAWER_ROLE = keccak256('COMMUNITY_FEE_WITHDRAWER');
  address private immutable factory;

  address public communityFeeReceiver;

  uint16 public algebraFee;
  bool public hasNewAlgebraFeeProposal;
  uint16 public proposedNewAlgebraFee;

  address public algebraFeeReceiver;

  address public algebraFeeManager;
  address private _pendingAlgebraFeeManager;

  uint16 constant ALGEBRA_FEE_DENOMINATOR = 1000;

  modifier onlyFactoryOwner() {
    require(msg.sender == IAlgebraFactory(factory).owner());
    _;
  }

  modifier onlyWithdrawer() {
    require(msg.sender == algebraFeeManager || IAlgebraFactory(factory).hasRoleOrOwner(COMMUNITY_FEE_WITHDRAWER_ROLE, msg.sender));
    _;
  }

  modifier onlyAlgebraFeeManager() {
    require(msg.sender == algebraFeeManager);
    _;
  }

  constructor(address _algebraFeeManager) {
    factory = msg.sender;
    algebraFeeManager = _algebraFeeManager;
  }

  function withdraw(address token, uint256 amount) external onlyWithdrawer {
    uint16 _algebraFee = algebraFee;
    address _algebraFeeReceiver;
    if (_algebraFee != 0) {
      _algebraFeeReceiver = algebraFeeReceiver;
      require(_algebraFeeReceiver != address(0), 'invalid algebra fee receiver');
    }

    address _communityFeeReceiver = communityFeeReceiver;
    require(_communityFeeReceiver != address(0), 'invalid receiver');

    _withdraw(token, _communityFeeReceiver, amount, _algebraFee, _algebraFeeReceiver);
  }

  struct WithdrawTokensParams {
    address token;
    uint256 amount;
  }

  function withdrawTokens(WithdrawTokensParams[] calldata params) external onlyWithdrawer {
    uint256 paramsLength = params.length;
    uint16 _algebraFee = algebraFee;

    address _algebraFeeReceiver;
    if (_algebraFee != 0) {
      _algebraFeeReceiver = algebraFeeReceiver;
      require(_algebraFeeReceiver != address(0), 'invalid algebra fee receiver');
    }
    address _communityFeeReceiver = communityFeeReceiver;
    require(_communityFeeReceiver != address(0), 'invalid receiver');

    unchecked {
      for (uint256 i; i < paramsLength; ++i) _withdraw(params[i].token, _communityFeeReceiver, params[i].amount, _algebraFee, _algebraFeeReceiver);
    }
  }

  function _withdraw(address token, address to, uint256 amount, uint16 _algebraFee, address _algebraFeeReceiver) private {
    uint256 withdrawAmount = amount;
    if (_algebraFee != 0 && _algebraFeeReceiver != address(0)) {
      uint256 algebraFeeAmount = FullMath.mulDivRoundingUp(withdrawAmount, _algebraFee, ALGEBRA_FEE_DENOMINATOR);
      withdrawAmount -= algebraFeeAmount;
      SafeTransfer.safeTransfer(token, _algebraFeeReceiver, algebraFeeAmount);
    }

    SafeTransfer.safeTransfer(token, to, withdrawAmount);
    emit TokensWithdrawal(token, to, amount);
  }

  // ### algebra factory owner permissioned actions ###

  function acceptAlgebraFeeChangeProposal(uint16 newAlgebraFee) external onlyFactoryOwner {
    require(hasNewAlgebraFeeProposal, 'not proposed');
    require(newAlgebraFee == proposedNewAlgebraFee, 'invalid new fee');

    algebraFee = newAlgebraFee;

    hasNewAlgebraFeeProposal = false;
    proposedNewAlgebraFee = 0;
  }

  function changeCommunityFeeReceiver(address newCommunityFeeReceiver) external onlyFactoryOwner {
    require(newCommunityFeeReceiver != address(0));
    communityFeeReceiver = newCommunityFeeReceiver;
  }

  // ### algebra fee manager permissioned actions ###

  function transferAlgebraFeeManagerRole(address _newAlgebraFeeManager) external onlyAlgebraFeeManager {
    _pendingAlgebraFeeManager = _newAlgebraFeeManager;
  }

  function acceptAlgebraFeeManagerRole() external {
    require(msg.sender == _pendingAlgebraFeeManager);
    _pendingAlgebraFeeManager = address(0);
    algebraFeeManager = msg.sender;
  }

  function proposeAlgebraFeeChange(uint16 newAlgebraFee) external onlyAlgebraFeeManager {
    require(newAlgebraFee <= ALGEBRA_FEE_DENOMINATOR);
    proposedNewAlgebraFee = newAlgebraFee;
    hasNewAlgebraFeeProposal = true;
  }

  function cancelAlgebraFeeChangeProposal() external onlyAlgebraFeeManager {
    proposedNewAlgebraFee = 0;
    hasNewAlgebraFeeProposal = false;
  }

  function changeAlgebraFeeReceiver(address newAlgebraFeeReceiver) external onlyAlgebraFeeManager {
    require(newAlgebraFeeReceiver != address(0));
    algebraFeeReceiver = newAlgebraFeeReceiver;
  }
}
