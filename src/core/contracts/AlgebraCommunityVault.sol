// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import './libraries/SafeTransfer.sol';
import './libraries/FullMath.sol';

import './interfaces/IAlgebraFactory.sol';

/// @title Algebra community fee vault
/// @notice Community fee from pools is sent here, if it is enabled
/// @dev Role system is used to withdraw tokens
contract AlgebraCommunityVault {
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

  /// @notice Emitted when the Algebra fee is changed
  /// @param newAlgebraFee The new Algebra fee value
  event AlgebraFee(uint16 newAlgebraFee);

  /// @notice Emitted when a CommunityFeeReceiver address changed
  /// @param newCommunityFeeReceiver New fee receiver address
  event CommunityFeeReceiver(address newCommunityFeeReceiver);

  /// @dev The role can be granted in AlgebraFactory
  bytes32 public constant COMMUNITY_FEE_WITHDRAWER_ROLE = keccak256('COMMUNITY_FEE_WITHDRAWER');
  /// @notice Factory contract address
  address private immutable factory;
  /// @notice Address to which protocol commissions are sent from vault
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

  /// @notice Withdraw protocol fees from vault
  /// @dev Can only be called by algebraFeeManager or communityFeeReceiver
  /// @param token The token address
  /// @param amount The amount of token
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

  /// @notice Withdraw protocol fees from vault. Used to claim fees for multiple tokens
  /// @dev Can be called by algebraFeeManager or communityFeeReceiver
  /// @param params Array of WithdrawTokensParams objects containing token addresses and amounts to withdraw
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
      emit AlgebraTokensWithdrawal(token, _algebraFeeReceiver, algebraFeeAmount);
    }

    SafeTransfer.safeTransfer(token, to, withdrawAmount);
    emit TokensWithdrawal(token, to, withdrawAmount);
  }

  // ### algebra factory owner permissioned actions ###

  /// @notice Accepts the proposed new Algebra fee
  /// @dev Can only be called by the factory owner
  /// @param newAlgebraFee New Algebra fee value
  function acceptAlgebraFeeChangeProposal(uint16 newAlgebraFee) external onlyFactoryOwner {
    require(hasNewAlgebraFeeProposal, 'not proposed');
    require(newAlgebraFee == proposedNewAlgebraFee, 'invalid new fee');

    algebraFee = newAlgebraFee;

    hasNewAlgebraFeeProposal = false;
    proposedNewAlgebraFee = 0;
    emit AlgebraFee(newAlgebraFee);
  }

  /// @notice Change community fee receiver address
  /// @dev Can only be called by the factory owner
  /// @param newCommunityFeeReceiver New community fee receiver address
  function changeCommunityFeeReceiver(address newCommunityFeeReceiver) external onlyFactoryOwner {
    require(newCommunityFeeReceiver != address(0));
    communityFeeReceiver = newCommunityFeeReceiver;
    emit CommunityFeeReceiver(newCommunityFeeReceiver);
  }

  // ### algebra fee manager permissioned actions ###

  /// @notice Transfers Algebra fee manager role
  /// @param _newAlgebraFeeManager new Algebra fee manager address
  function transferAlgebraFeeManagerRole(address _newAlgebraFeeManager) external onlyAlgebraFeeManager {
    _pendingAlgebraFeeManager = _newAlgebraFeeManager;
  }

  /// @notice Accept Algebra fee manager role
  function acceptAlgebraFeeManagerRole() external {
    require(msg.sender == _pendingAlgebraFeeManager);
    _pendingAlgebraFeeManager = address(0);
    algebraFeeManager = msg.sender;
  }

  /// @notice Suggests new Algebra fee value
  /// @param newAlgebraFee new Algebra fee value
  function proposeAlgebraFeeChange(uint16 newAlgebraFee) external onlyAlgebraFeeManager {
    require(newAlgebraFee <= ALGEBRA_FEE_DENOMINATOR);
    proposedNewAlgebraFee = newAlgebraFee;
    hasNewAlgebraFeeProposal = true;
  }

  /// @notice Cancels Algebra fee change proposal
  function cancelAlgebraFeeChangeProposal() external onlyAlgebraFeeManager {
    proposedNewAlgebraFee = 0;
    hasNewAlgebraFeeProposal = false;
  }

  /// @notice Change Algebra community fee part receiver
  /// @param newAlgebraFeeReceiver The address of new Algebra fee receiver
  function changeAlgebraFeeReceiver(address newAlgebraFeeReceiver) external onlyAlgebraFeeManager {
    require(newAlgebraFeeReceiver != address(0));
    algebraFeeReceiver = newAlgebraFeeReceiver;
    emit AlgebraFeeReceiver(newAlgebraFeeReceiver);
  }
}
