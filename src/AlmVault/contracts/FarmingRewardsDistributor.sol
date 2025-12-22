// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IERC20Metadata} from '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {IAccessControl} from '@openzeppelin/contracts/access/IAccessControl.sol';
import {EnumerableSet} from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import {Pausable} from '@openzeppelin/contracts/security/Pausable.sol';

import {IAlgebraVault} from './interfaces/IAlgebraVault.sol';
import {IAlgebraVaultFactory} from './interfaces/IAlgebraVaultFactory.sol';
import {IFarmingRewardsDistributor} from './interfaces/IFarmingRewardsDistributor.sol';

/// @title Farming Rewards Distributor
contract FarmingRewardsDistributor is IFarmingRewardsDistributor, Pausable {
  using SafeERC20 for IERC20;
  using EnumerableSet for EnumerableSet.AddressSet;

  /********************** Contract Addresses ***********************/

  /// @notice Address of the factory
  address public immutable override algebraVaultFactory;

  /// @notice Address of LP token
  address public immutable override stakingToken;

  /********************** Lock & Earn Info ***********************/

  /// @notice Total locked value
  uint256 public override totalStakes;

  /********************** Reward Info ***********************/

  /// @notice address => RPT
  mapping(address => UserData) internal userData;

  /// @notice Reward tokens being distributed
  address[] public override rewardTokens;

  /// @notice Set of whitelisted reward tokens
  EnumerableSet.AddressSet private rewardTokensSet;

  /// @notice address => RPT
  mapping(address => RewardData) public override rewardData;

  /// @notice rewardToken => user => claimable amount
  mapping(address => mapping(address => uint256)) public override claimable;

  function _checkManager() private view {
    if (!IAccessControl(algebraVaultFactory).hasRole(IAlgebraVaultFactory(algebraVaultFactory).MANAGER_ROLE(), msg.sender))
      revert InsufficientPermission();
  }

  modifier onlyManager() {
    _checkManager();
    _;
  }

  constructor(address _stakingToken) {
    if (_stakingToken == address(0)) revert AddressZero();
    stakingToken = _stakingToken;

    algebraVaultFactory = msg.sender;
  }

  /********************** Setters ***********************/

  /**
   * @notice Add a new reward token to be distributed to stakers.
   * @param _rewardToken address
   */
  function addReward(address _rewardToken) external override onlyManager {
    if (_rewardToken == address(0)) revert InvalidBurn();
    if (_rewardToken == stakingToken) revert IsStakingToken();
    for (uint i; i < rewardTokens.length; i++) {
      if (rewardTokens[i] == _rewardToken) revert ActiveReward();
    }
    rewardTokens.push(_rewardToken);
    rewardTokensSet.add(_rewardToken);
  }

  /********************** View functions ***********************/

  /**
   * @notice Added to support recovering LP Rewards from other systems such as BAL to be distributed to holders.
   * @param tokenAddress to recover.
   * @param tokenAmount to recover.
   */
  function recoverERC20(address tokenAddress, uint256 tokenAmount) external override onlyManager {
    if (tokenAddress == stakingToken) revert IsStakingToken();
    if (rewardData[tokenAddress].lastTimeUpdated > 0) revert ActiveReward();
    IERC20(tokenAddress).safeTransfer(msg.sender, tokenAmount);
    emit Recovered(tokenAddress, tokenAmount);
  }

  /**
   * @notice Total balance of an account, including unlocked, locked and earned tokens.
   * @param user address.
   */
  function totalBalance(address user) external view override returns (uint256) {
    return userData[user].tokenAmount;
  }

  /// @dev added this function as it doesn't seem possible to get this using the ABI
  ///      https://ethereum.stackexchange.com/questions/143185/retreive-a-mapping-nested-inside-a-struct-from-ethers
  function getUserRewardPerToken(address user, address rewardToken) external view override returns (uint256) {
    return userData[user].rewardPerToken[rewardToken];
  }

  function getUserData(address user) external view override returns (uint256 tokenAmount, uint256 lastTimeUpdated, uint256 tokenClaimable) {
    tokenAmount = userData[user].tokenAmount;
    lastTimeUpdated = userData[user].lastTimeUpdated;
    tokenClaimable = userData[user].tokenClaimable;
  }

  /********************** Reward functions ***********************/

  /**
   * @notice Address and claimable amount of all reward tokens for the given account.
   * @param account for rewards
   * @return rewardsData array of rewards
   * @dev this estimation doesn't include rewards that are yet to be collected from the AlgebraVault via collectRewards
   */
  function claimableRewards(address account) public view override returns (address[] memory, uint256[] memory) {
    uint256[] memory rewardAmounts = new uint256[](rewardTokens.length);
    for (uint256 i; i < rewardTokens.length; i++) {
      rewardAmounts[i] = claimable[rewardTokens[i]][account] + _earned(account, rewardTokens[i]) / 1e50;
    }
    return (rewardTokens, rewardAmounts);
  }

  /********************** Operate functions ***********************/

  /**
   * @notice Stake tokens to receive rewards.
   * @dev Locked tokens cannot be withdrawn for defaultLockDuration and are eligible to receive rewards.
   * @param amount to stake.
   * @param onBehalfOf address for staking.
   */
  function stake(uint256 amount, address onBehalfOf) external override {
    _stake(amount, onBehalfOf);
  }

  /**
   * @notice Stake tokens to receive rewards.
   * @dev Locked tokens cannot be withdrawn for defaultLockDuration and are eligible to receive rewards.
   * @param amount to stake.
   * @param onBehalfOf address for staking.
   */
  function _stake(uint256 amount, address onBehalfOf) internal whenNotPaused {
    if (amount == 0) revert InvalidAmount();
    _updateReward();

    for (uint i; i < rewardTokens.length; i++) {
      _calculateClaimable(onBehalfOf, rewardTokens[i]);
    }

    IERC20(stakingToken).safeTransferFrom(msg.sender, address(this), amount);
    UserData storage userInfo = userData[onBehalfOf];
    userInfo.tokenAmount += amount;
    totalStakes += amount;

    emit Stake(onBehalfOf, amount);
  }

  function unstake(uint256 amount) external override {
    _unstake(amount, msg.sender);
    _getReward(msg.sender, rewardTokens);
  }

  function _unstake(uint256 amount, address onBehalfOf) internal {
    UserData storage userInfo = userData[onBehalfOf];
    if (userInfo.tokenAmount < amount || amount == 0) revert InvalidAmount();
    _updateReward();
    for (uint i; i < rewardTokens.length; i++) {
      _calculateClaimable(onBehalfOf, rewardTokens[i]);
    }
    IERC20(stakingToken).safeTransfer(onBehalfOf, amount);

    userInfo.tokenAmount -= amount;
    totalStakes -= amount;

    emit Unstake(onBehalfOf, amount);
  }

  /**
   * @notice Claim all pending staking rewards.
   * @param _rewardTokens array of reward tokens
   */
  function getReward(address _onBehalfOf, address[] memory _rewardTokens) external override returns (uint256[] memory claimableAmounts) {
    claimableAmounts = _getReward(_onBehalfOf, _rewardTokens);
  }

  /**
   * @notice Claim all pending staking rewards.
   */
  function getAllRewards() external override returns (uint256[] memory claimableAmounts) {
    claimableAmounts = _getReward(msg.sender, rewardTokens);
  }

  function updateReward() external override {
    _updateReward();
  }

  /**
   * @notice Calculate earnings.
   * @param _user address of earning owner
   * @param _rewardToken address
   * @return earnings amount
   */
  function _earned(address _user, address _rewardToken) internal view returns (uint256 earnings) {
    RewardData memory rewardInfo = rewardData[_rewardToken];
    UserData storage userInfo = userData[_user];

    return (rewardInfo.rewardPerToken - userInfo.rewardPerToken[_rewardToken]) * userInfo.tokenAmount;
  }

  /**
   * @notice Update user reward info.
   */
  function _updateReward() internal {
    IAlgebraVault(stakingToken).collectRewards();
    for (uint i; i < rewardTokens.length; i++) {
      address rewardToken = rewardTokens[i];
      if (totalStakes > 0) {
        RewardData storage r = rewardData[rewardToken];
        uint256 currentBalance = IERC20(rewardToken).balanceOf(address(this));
        uint256 diff = currentBalance - r.amount;
        r.lastTimeUpdated = block.timestamp;
        r.rewardPerToken += (diff * 1e50) / totalStakes;
        r.amount = currentBalance;
      }
    }
    emit RewardsUpdated();
  }

  function _calculateClaimable(address _onBehalf, address _rewardToken) internal {
    UserData storage userInfo = userData[_onBehalf];
    RewardData memory r = rewardData[_rewardToken];

    if (userInfo.lastTimeUpdated > 0 && userInfo.tokenAmount > 0) {
      claimable[_rewardToken][_onBehalf] += ((r.rewardPerToken - userInfo.rewardPerToken[_rewardToken]) * userInfo.tokenAmount) / 1e50;
    }

    userInfo.rewardPerToken[_rewardToken] = r.rewardPerToken;
    userInfo.lastTimeUpdated = block.timestamp;
  }

  /**
   * @notice User gets reward
   * @param _user address
   * @param _rewardTokens array of reward tokens
   */
  function _getReward(address _user, address[] memory _rewardTokens) internal whenNotPaused returns (uint256[] memory claimableAmounts) {
    claimableAmounts = new uint256[](_rewardTokens.length);

    _updateReward();

    for (uint256 i; i < _rewardTokens.length; i++) {
      address token = _rewardTokens[i];
      if (!rewardTokensSet.contains(token)) revert InvalidRewardToken();
      RewardData storage r = rewardData[token];
      _calculateClaimable(_user, token);
      if (claimable[token][_user] > 0) {
        // we store the claimableAmount for this current rewardToken
        uint256 claimableAmount = claimable[token][_user];
        claimableAmounts[i] = claimableAmount;

        r.amount -= claimableAmount;
        claimable[token][_user] = 0;

        IERC20(token).safeTransfer(_user, claimableAmount);
        emit RewardPaid(_user, token, claimableAmount);
      }
    }
  }

  /********************** Eligibility + Disqualification ***********************/

  /**
   * @notice Pause FRD functionalities
   */
  function pause() public override onlyManager {
    _pause();
  }

  /**
   * @notice Resume FRD functionalities
   */
  function unpause() public override onlyManager {
    _unpause();
  }
}
