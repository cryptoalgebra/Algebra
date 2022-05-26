// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol';

import 'algebra/contracts/interfaces/IAlgebraPoolDeployer.sol';
import 'algebra/contracts/interfaces/IAlgebraPool.sol';
import 'algebra/contracts/interfaces/IERC20Minimal.sol';

import './IFarmingCenter.sol';
import './IIncentiveKey.sol';

import 'algebra-periphery/contracts/interfaces/IERC721Permit.sol';
import 'algebra-periphery/contracts/interfaces/INonfungiblePositionManager.sol';
import 'algebra-periphery/contracts/interfaces/IMulticall.sol';

/// @title Algebra Farming Interface
/// @notice Allows farming nonfungible liquidity tokens in exchange for reward tokens
interface IAlgebraFarming is IIncentiveKey, IMulticall {
    /// @notice The nonfungible position manager with which this farming contract is compatible
    function nonfungiblePositionManager() external view returns (INonfungiblePositionManager);

    /// @notice The max duration of an incentive in seconds
    function maxIncentiveDuration() external view returns (uint256);

    /// @notice The max amount of seconds into the future the incentive startTime can be set
    function maxIncentiveStartLeadTime() external view returns (uint256);

    /// @notice FarmingCenter
    function farmingCenter() external view returns (IFarmingCenter);

    function deployer() external returns (IAlgebraPoolDeployer);

    function setIncentiveMaker(address _incentiveMaker) external;

    struct Levels {
        // amount of token to reach the level
        uint tokenAmountForLevel1;
        uint tokenAmountForLevel2;
        uint tokenAmountForLevel3;
        // 1 = 0.01%
        uint32 level1multiplier;
        uint32 level2multiplier;
        uint32 level3multiplier;
    }

    /// @notice Detach incentive from the pool
    /// @param key The key of the incentive
    function detachIncentive(IncentiveKey memory key) external;

    /// @notice Attach incentive to the pool
    /// @param key The key of the incentive
    function attachIncentive(IncentiveKey memory key) external;

    /// @notice Returns amounts of reward tokens owed to a given address according to the last time all farms were updated
    /// @param rewardToken The token for which to check rewards
    /// @param owner The owner for which the rewards owed are checked
    /// @return rewardsOwed The amount of the reward token claimable by the owner
    function rewards(IERC20Minimal rewardToken, address owner) external view returns (uint256 rewardsOwed);

    /// @notice
    function setFarmingCenterAddress(address _farmingCenter) external;

    /// @notice exitFarmings for Algebra LP token
    /// @param key The key of the incentive for which to exitFarming the NFT
    /// @param tokenId The ID of the token to exitFarming
    function exitFarming(
        IncentiveKey memory key,
        uint256 tokenId,
        address _owner
    ) external;

    /// @notice Transfers `amountRequested` of accrued `rewardToken` rewards from the contract to the recipient `to`
    /// @param rewardToken The token being distributed as a reward
    /// @param to The address where claimed rewards will be sent to
    /// @param amountRequested The amount of reward tokens to claim. Claims entire reward amount if set to 0.
    /// @return reward The amount of reward tokens claimed
    function claimReward(
        IERC20Minimal rewardToken,
        address to,
        uint256 amountRequested
    ) external returns (uint256 reward);

    /// @notice Transfers `amountRequested` of accrued `rewardToken` rewards from the contract to the recipient `to`
    /// @notice only for FarmingCenter
    /// @param rewardToken The token being distributed as a reward
    /// @param from The address of position owner
    /// @param to The address where claimed rewards will be sent to
    /// @param amountRequested The amount of reward tokens to claim. Claims entire reward amount if set to 0.
    /// @return reward The amount of reward tokens claimed
    function claimRewardFrom(
        IERC20Minimal rewardToken,
        address from,
        address to,
        uint256 amountRequested
    ) external returns (uint256 reward);

    /// @notice Calculates the reward amount that will be received for the given farm
    /// @param key The key of the incentive
    /// @param tokenId The ID of the token
    /// @return reward The reward accrued to the NFT for the given incentive thus far
    /// @return bonusReward The bonus reward accrued to the NFT for the given incentive thus far
    function getRewardInfo(IncentiveKey memory key, uint256 tokenId)
        external
        returns (uint256 reward, uint256 bonusReward);


    /// @notice Event emitted when a liquidity mining incentive has been stopped from the outside
    /// @param rewardToken The token being distributed as a reward
    /// @param bonusRewardToken The token being distributed as a bonus reward
    /// @param pool The Algebra pool
    /// @param virtualPool The virtual pool address
    /// @param startTime The time when the incentive program begins
    /// @param endTime The time when rewards stop accruing
    event IncentiveDetached(
        IERC20Minimal indexed rewardToken,
        IERC20Minimal indexed bonusRewardToken,
        IAlgebraPool indexed pool,
        address virtualPool,
        uint256 startTime,
        uint256 endTime
    );

    /// @notice Event emitted when a liquidity mining incentive has been runned again from the outside
    /// @param rewardToken The token being distributed as a reward
    /// @param bonusRewardToken The token being distributed as a bonus reward
    /// @param pool The Algebra pool
    /// @param virtualPool The virtual pool address
    /// @param startTime The time when the incentive program begins
    /// @param endTime The time when rewards stop accruing
    event IncentiveAttached(
        IERC20Minimal indexed rewardToken,
        IERC20Minimal indexed bonusRewardToken,
        IAlgebraPool indexed pool,
        address virtualPool,
        uint256 startTime,
        uint256 endTime
    );

    /// @notice Event emitted when a Algebra LP token has been exitFarmingd
    /// @param tokenId The unique identifier of an Algebra LP token
    /// @param incentiveId The incentive in which the token is farming
    /// @param rewardAddress The token being distributed as a reward
    /// @param bonusRewardToken The token being distributed as a bonus reward
    /// @param owner The address where claimed rewards were sent to
    /// @param reward The amount of reward tokens to be distributed
    /// @param bonusReward The amount of bonus reward tokens to be distributed
    event FarmEnded(
        uint256 indexed tokenId,
        bytes32 indexed incentiveId,
        address indexed rewardAddress,
        address bonusRewardToken,
        address owner,
        uint256 reward,
        uint256 bonusReward
    );

    /// @notice Emitted when the incentive maker is changed
    /// @param incentiveMaker The incentive maker address before the address was changed
    /// @param _incentiveMaker The factorincentive maker address after the address was changed
    event IncentiveMakerChanged(address indexed incentiveMaker, address indexed _incentiveMaker);

    /// @notice Event emitted when rewards were added
    /// @param rewardAmount The additional amount of main token
    /// @param bonusRewardAmount The additional amount of bonus token
    /// @param incentiveId The ID of the incentive for which rewards were added
    event RewardsAdded(uint256 rewardAmount, uint256 bonusRewardAmount, bytes32 incentiveId);

    /// @notice Event emitted when a reward token has been claimed
    /// @param to The address where claimed rewards were sent to
    /// @param reward The amount of reward tokens claimed
    /// @param rewardAddress The token reward address
    /// @param owner The address where claimed rewards were sent to
    event RewardClaimed(address indexed to, uint256 reward, address indexed rewardAddress, address indexed owner);
}
