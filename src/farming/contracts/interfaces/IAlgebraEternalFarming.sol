// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.4;

import '@cryptoalgebra/integral-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import '../base/IncentiveKey.sol';

/// @title Algebra Eternal Farming Interface
/// @notice Allows farming nonfungible liquidity tokens in exchange for reward tokens without locking NFT for incentive time
interface IAlgebraEternalFarming {
  /// @notice Details of the incentive to create
  struct IncentiveParams {
    uint128 reward; // The amount of reward tokens to be distributed
    uint128 bonusReward; // The amount of bonus reward tokens to be distributed
    uint128 rewardRate; // The rate of reward distribution per second
    uint128 bonusRewardRate; // The rate of bonus reward distribution per second
    uint24 minimalPositionWidth; // The minimal allowed width of position (tickUpper - tickLower)
  }

  error farmDoesNotExist();
  error tokenAlreadyFarmed();
  error incentiveNotExist();
  error incentiveStopped();
  error anotherFarmingIsActive();
  error pluginNotConnected();

  error minimalPositionWidthTooWide();
  error zeroRewardAmount();

  error positionIsTooNarrow();
  error zeroLiquidity();
  error invalidPool();
  error claimToZeroAddress();

  error invalidTokenAmount();

  error emergencyActivated();

  error reentrancyLock();
  error poolReentrancyLock();

  /// @notice Returns hash of 'INCENTIVE_MAKER_ROLE', used as role for incentive creation
  function INCENTIVE_MAKER_ROLE() external view returns (bytes32);

  /// @notice Returns hash of 'FARMINGS_ADMINISTRATOR_ROLE', used as role for permissioned actions in farming
  function FARMINGS_ADMINISTRATOR_ROLE() external view returns (bytes32);

  /// @notice The nonfungible position manager with which this farming contract is compatible
  function nonfungiblePositionManager() external view returns (INonfungiblePositionManager);

  /// @notice Represents a farming incentive
  /// @param incentiveId The ID of the incentive computed from its parameters
  function incentives(
    bytes32 incentiveId
  )
    external
    view
    returns (
      uint128 totalReward,
      uint128 bonusReward,
      address virtualPoolAddress,
      uint24 minimalPositionWidth,
      bool deactivated,
      address pluginAddress
    );

  /// @notice Check if incentive is deactivated (manually or automatically)
  /// @dev Does not check if the incentive is indeed currently connected to the Algebra pool or not
  /// @param incentiveId The ID of the incentive computed from its parameters
  /// @return True if incentive is deactivated (manually or automatically)
  function isIncentiveDeactivated(bytes32 incentiveId) external view returns (bool);

  /// @notice Returns address of current farmingCenter
  function farmingCenter() external view returns (address);

  /// @notice Users can withdraw liquidity without any checks if active.
  function isEmergencyWithdrawActivated() external view returns (bool);

  /// @notice Detach incentive from the pool and deactivate it
  /// @param key The key of the incentive
  function deactivateIncentive(IncentiveKey memory key) external;

  /// @notice Add rewards for incentive
  /// @param key The key of the incentive
  /// @param rewardAmount The amount of token0
  /// @param bonusRewardAmount The amount of token1
  function addRewards(IncentiveKey memory key, uint128 rewardAmount, uint128 bonusRewardAmount) external;

  /// @notice Decrease rewards for incentive and withdraw
  /// @param key The key of the incentive
  /// @param rewardAmount The amount of token0
  /// @param bonusRewardAmount The amount of token1
  function decreaseRewardsAmount(IncentiveKey memory key, uint128 rewardAmount, uint128 bonusRewardAmount) external;

  /// @notice Changes `isEmergencyWithdrawActivated`. Users can withdraw liquidity without any checks if activated.
  /// User cannot enter to farmings if activated.
  /// _Must_ only be used in emergency situations. Farmings may be unusable after activation.
  /// @dev only farmings administrator
  /// @param newStatus The new status of `isEmergencyWithdrawActivated`.
  function setEmergencyWithdrawStatus(bool newStatus) external;

  /// @notice Returns amount of created incentives
  function numOfIncentives() external view returns (uint256);

  /// @notice Returns amounts of reward tokens owed to a given address according to the last time all farms were updated
  /// @param owner The owner for which the rewards owed are checked
  /// @param rewardToken The token for which to check rewards
  /// @return rewardsOwed The amount of the reward token claimable by the owner
  function rewards(address owner, IERC20Minimal rewardToken) external view returns (uint256 rewardsOwed);

  /// @notice Updates farming center address
  /// @param _farmingCenter The new farming center contract address
  function setFarmingCenterAddress(address _farmingCenter) external;

  /// @notice enter farming for Algebra LP token
  /// @param key The key of the incentive for which to enter farming
  /// @param tokenId The ID of the token to enter farming
  function enterFarming(IncentiveKey memory key, uint256 tokenId) external;

  /// @notice exitFarmings for Algebra LP token
  /// @param key The key of the incentive for which to exit farming
  /// @param tokenId The ID of the token to exit farming
  /// @param _owner Owner of the token
  function exitFarming(IncentiveKey memory key, uint256 tokenId, address _owner) external;

  /// @notice Transfers `amountRequested` of accrued `rewardToken` (if possible) rewards from the contract to the recipient `to`
  /// @param rewardToken The token being distributed as a reward
  /// @param to The address where claimed rewards will be sent to
  /// @param amountRequested The amount of reward tokens to claim. Claims entire reward amount if set to 0.
  /// @return rewardBalanceBefore The total amount of unclaimed reward *before* claim
  function claimReward(IERC20Minimal rewardToken, address to, uint256 amountRequested) external returns (uint256 rewardBalanceBefore);

  /// @notice Transfers `amountRequested` of accrued `rewardToken` (if possible) rewards from the contract to the recipient `to`
  /// @notice only for FarmingCenter
  /// @param rewardToken The token being distributed as a reward
  /// @param from The address of position owner
  /// @param to The address where claimed rewards will be sent to
  /// @param amountRequested The amount of reward tokens to claim. Claims entire reward amount if set to 0.
  /// @return rewardBalanceBefore The total amount of unclaimed reward *before* claim
  function claimRewardFrom(
    IERC20Minimal rewardToken,
    address from,
    address to,
    uint256 amountRequested
  ) external returns (uint256 rewardBalanceBefore);

  /// @notice Calculates the reward amount that will be received for the given farm
  /// @param key The key of the incentive
  /// @param tokenId The ID of the token
  /// @return reward The reward accrued to the NFT for the given incentive thus far
  /// @return bonusReward The bonus reward accrued to the NFT for the given incentive thus far
  function getRewardInfo(IncentiveKey memory key, uint256 tokenId) external returns (uint256 reward, uint256 bonusReward);

  /// @notice Returns information about a farmed liquidity NFT
  /// @param tokenId The ID of the farmed token
  /// @param incentiveId The ID of the incentive for which the token is farmed
  /// @return liquidity The amount of liquidity in the NFT as of the last time the rewards were computed,
  /// @return tickLower The lower tick of position,
  /// @return tickUpper The upper tick of position,
  /// @return innerRewardGrowth0 The last saved reward0 growth inside position,
  /// @return innerRewardGrowth1 The last saved reward1 growth inside position
  function farms(
    uint256 tokenId,
    bytes32 incentiveId
  ) external view returns (uint128 liquidity, int24 tickLower, int24 tickUpper, uint256 innerRewardGrowth0, uint256 innerRewardGrowth1);

  /// @notice Creates a new liquidity farming incentive program
  /// @param key Details of the incentive to create
  /// @param params Params of incentive
  /// @param plugin The address of corresponding plugin
  /// @return virtualPool The created virtual pool
  function createEternalFarming(IncentiveKey memory key, IncentiveParams memory params, address plugin) external returns (address virtualPool);

  /// @notice Change reward rates for incentive
  /// @param key The key of incentive
  /// @param rewardRate The new rate of main token (token0) distribution per sec
  /// @param bonusRewardRate The new rate of bonus token (token1) distribution per sec
  function setRates(IncentiveKey memory key, uint128 rewardRate, uint128 bonusRewardRate) external;

  /// @notice Collect rewards for tokenId
  /// @dev only FarmingCenter
  /// @param key The key of incentive
  /// @param tokenId The ID of the token to exit farming
  /// @param _owner Owner of the token
  /// @return reward The amount of main token (token0) collected
  /// @param bonusReward The amount of bonus token (token1) collected
  function collectRewards(IncentiveKey memory key, uint256 tokenId, address _owner) external returns (uint256 reward, uint256 bonusReward);

  /// @notice Event emitted when a liquidity mining incentive has been stopped from the outside
  /// @param incentiveId The stopped incentive
  event IncentiveDeactivated(bytes32 indexed incentiveId);

  /// @notice Event emitted when a Algebra LP token has been farmed
  /// @param tokenId The unique identifier of an Algebra LP token
  /// @param incentiveId The incentive in which the token is farming
  /// @param liquidity The amount of liquidity farmed
  event FarmEntered(uint256 indexed tokenId, bytes32 indexed incentiveId, uint128 liquidity);

  /// @notice Event emitted when a Algebra LP token exited from farming
  /// @param tokenId The unique identifier of an Algebra LP token
  /// @param incentiveId The incentive in which the token is farming
  /// @param rewardAddress The token being distributed as a reward
  /// @param bonusRewardToken The token being distributed as a bonus reward
  /// @param owner The address where claimed rewards were sent to
  /// @param reward The amount of reward tokens to be claimed
  /// @param bonusReward The amount of bonus reward tokens to be claimed
  event FarmEnded(
    uint256 indexed tokenId,
    bytes32 indexed incentiveId,
    address indexed rewardAddress,
    address bonusRewardToken,
    address owner,
    uint256 reward,
    uint256 bonusReward
  );

  /// @notice Emitted when the farming center is changed
  /// @param farmingCenter The farming center after the address was changed
  event FarmingCenter(address indexed farmingCenter);

  /// @notice Event emitted when rewards were added
  /// @param rewardAmount The additional amount of main token
  /// @param bonusRewardAmount The additional amount of bonus token
  /// @param incentiveId The ID of the incentive for which rewards were added
  event RewardsAdded(uint256 rewardAmount, uint256 bonusRewardAmount, bytes32 incentiveId);

  /// @notice Event emitted when rewards were decreased
  /// @param rewardAmount The withdrawn amount of main token
  /// @param bonusRewardAmount The withdrawn amount of bonus token
  /// @param incentiveId The ID of the incentive for which rewards were decreased
  event RewardAmountsDecreased(uint256 rewardAmount, uint256 bonusRewardAmount, bytes32 incentiveId);

  /// @notice Event emitted when a reward token has been claimed
  /// @param to The address where claimed rewards were sent to
  /// @param reward The amount of reward tokens claimed
  /// @param rewardAddress The token reward address
  /// @param owner The address where claimed rewards were claimed from
  event RewardClaimed(address indexed to, uint256 reward, address indexed rewardAddress, address indexed owner);

  /// @notice Event emitted when reward rates were changed
  /// @param rewardRate The new rate of main token (token0) distribution per sec
  /// @param bonusRewardRate The new rate of bonus token (token1) distribution per sec
  /// @param incentiveId The ID of the incentive for which rates were changed
  event RewardsRatesChanged(uint128 rewardRate, uint128 bonusRewardRate, bytes32 incentiveId);

  /// @notice Event emitted when rewards were collected
  /// @param tokenId The ID of the token for which rewards were collected
  /// @param incentiveId The ID of the incentive for which rewards were collected
  /// @param rewardAmount Collected amount of reward
  /// @param bonusRewardAmount Collected amount of bonus reward
  event RewardsCollected(uint256 tokenId, bytes32 incentiveId, uint256 rewardAmount, uint256 bonusRewardAmount);

  /// @notice Event emitted when a liquidity mining incentive has been created
  /// @param rewardToken The token being distributed as a reward
  /// @param bonusRewardToken The token being distributed as a bonus reward
  /// @param pool The Algebra pool
  /// @param virtualPool The virtual pool address
  /// @param nonce The nonce of new farming
  /// @param reward The amount of reward tokens to be distributed
  /// @param bonusReward The amount of bonus reward tokens to be distributed
  /// @param minimalAllowedPositionWidth The minimal allowed position width (tickUpper - tickLower)
  event EternalFarmingCreated(
    IERC20Minimal indexed rewardToken,
    IERC20Minimal indexed bonusRewardToken,
    IAlgebraPool indexed pool,
    address virtualPool,
    uint256 nonce,
    uint256 reward,
    uint256 bonusReward,
    uint24 minimalAllowedPositionWidth
  );

  /// @notice Emitted when status of `isEmergencyWithdrawActivated` changes
  /// @param newStatus New value of `isEmergencyWithdrawActivated`. Users can withdraw liquidity without any checks if active.
  event EmergencyWithdraw(bool newStatus);
}
