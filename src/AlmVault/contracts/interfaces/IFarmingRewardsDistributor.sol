// SPDX-License-Identifier: MIT

pragma solidity >=0.8.4;

interface IFarmingRewardsDistributor {
  struct RewardData {
    uint256 amount;
    uint256 lastTimeUpdated; // seems like it exists only for a null check in recoverERC20? i.e. if active reward don't allow owner to recover the reward token
    uint256 rewardPerToken;
  }

  struct UserData {
    uint256 tokenAmount;
    uint256 lastTimeUpdated; // TODO: is this even really needed??
    uint256 tokenClaimable; // TODO: is this even used??
    mapping(address => uint256) rewardPerToken;
  }

  /// @notice Address of the factory
  function algebraVaultFactory() external view returns (address);

  /// @notice Address of LP token
  function stakingToken() external view returns (address);

  /// @notice Total locked value
  function totalStakes() external view returns (uint256);

  /// @notice Reward tokens being distributed
  function rewardTokens(uint256) external view returns (address);

  /// @notice address => RPT
  function rewardData(address) external view returns (uint256, uint256, uint256);

  /// @notice rewardToken => user => claimable amount
  function claimable(address, address) external view returns (uint256);

  event Stake(address indexed user, uint256 amount);
  event Unstake(address indexed user, uint256 receivedAmount);
  event RewardPaid(address indexed user, address indexed rewardToken, uint256 reward);
  event Recovered(address indexed token, uint256 amount);
  event RewardsUpdated();

  /********************** Errors ***********************/
  error AddressZero();
  error InvalidBurn();
  error InsufficientPermission();
  error ActiveReward();
  error IsStakingToken();
  error InvalidAmount();
  error InvalidRewardToken();

  /**
   * @notice Add a new reward token to be distributed to stakers.
   * @param _rewardToken address
   */
  function addReward(address _rewardToken) external;

  /********************** View functions ***********************/

  /**
   * @notice Added to support recovering LP Rewards from other systems such as BAL to be distributed to holders.
   * @param tokenAddress to recover.
   * @param tokenAmount to recover.
   */
  function recoverERC20(address tokenAddress, uint256 tokenAmount) external;

  /**
   * @notice Total balance of an account, including unlocked, locked and earned tokens.
   * @param user address.
   */
  function totalBalance(address user) external view returns (uint256);

  function getUserData(address) external view returns (uint256, uint256, uint256);

  /// @dev added this function as it doesn't seem possible to get this using the ABI
  ///      https://ethereum.stackexchange.com/questions/143185/retreive-a-mapping-nested-inside-a-struct-from-ethers
  function getUserRewardPerToken(address user, address rewardToken) external view returns (uint256);

  /********************** Reward functions ***********************/

  /**
   * @notice Address and claimable amount of all reward tokens for the given account.
   * @param account for rewards
   * @return rewardsData array of rewards
   * @dev this estimation doesn't include rewards that are yet to be collected from the AlgebraVault via collectRewards
   */
  function claimableRewards(address account) external view returns (address[] memory, uint256[] memory);

  /********************** Operate functions ***********************/

  /**
   * @notice Stake tokens to receive rewards.
   * @dev Locked tokens cannot be withdrawn for defaultLockDuration and are eligible to receive rewards.
   * @param amount to stake.
   * @param onBehalfOf address for staking.
   */
  function stake(uint256 amount, address onBehalfOf) external;

  function unstake(uint256 amount) external;

  /**
   * @notice Claim all pending staking rewards.
   * @param _rewardTokens array of reward tokens
   */
  function getReward(address _onBehalfOf, address[] memory _rewardTokens) external returns (uint256[] memory claimableAmounts);

  /**
   * @notice Claim all pending staking rewards.
   */
  function getAllRewards() external returns (uint256[] memory claimableAmounts);

  function updateReward() external;

  /********************** Eligibility + Disqualification ***********************/

  /**
   * @notice Pause MFD functionalities
   */
  function pause() external;

  /**
   * @notice Resume MFD functionalities
   */
  function unpause() external;
}
