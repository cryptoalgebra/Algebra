// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;
import '../../interfaces/IAlgebraFarming.sol';

/// @title Algebra Farming Interface
/// @notice Allows farming nonfungible liquidity tokens in exchange for reward tokens
interface IAlgebraEternalFarming is IAlgebraFarming {
    /// @notice Event emitted when reward rates were changed
    /// @param rewardRate The new rate of main token distribution per sec
    /// @param bonusRewardRate The new rate of bonus token distribution per sec
    /// @param incentiveId The ID of the incentive for which rates were changed
    event RewardsRatesChanged(uint128 rewardRate, uint128 bonusRewardRate, bytes32 incentiveId);

    /// @notice Event emitted when rewards were added
    /// @param tokenId The ID of the token for which rewards were collected
    /// @param incentiveId The ID of the incentive for which rewards were collected
    /// @param rewardAmount Collected amount of reward
    /// @param bonusRewardAmount Collected amount of bonus reward
    event RewardsCollected(uint256 tokenId, bytes32 incentiveId, uint256 rewardAmount, uint256 bonusRewardAmount);

    /// @notice Returns information about a farmd liquidity NFT
    /// @param tokenId The ID of the farmd token
    /// @param incentiveId The ID of the incentive for which the token is farmd
    /// @return liquidity The amount of liquidity in the NFT as of the last time the rewards were computed
    function farms(uint256 tokenId, bytes32 incentiveId)
        external
        view
        returns (
            uint128 liquidity,
            int24 tickLower,
            int24 tickUpper,
            uint256 innerRewardGrowth0,
            uint256 innerRewardGrowth1
        );

    /// @notice Represents a farming incentive
    /// @param incentiveId The ID of the incentive computed from its parameters
    function incentives(bytes32 incentiveId)
        external
        view
        returns (
            uint256 totalReward,
            uint256 bonusReward,
            address virtualPoolAddress,
            uint96 numberOfFarms,
            bool isPoolCreated,
            uint224 totalLiquidity,
            address multiplierToken,
            Levels calldata levels
        );

    /// @notice Creates a new liquidity mining incentive program
    /// @param key Details of the incentive to create
    /// @param reward The amount of reward tokens to be distributed
    /// @param bonusReward The amount of bonus reward tokens to be distributed
    /// @return virtualPool The virtual pool
    function createIncentive(
        IncentiveKey memory key,
        uint256 reward,
        uint256 bonusReward,
        uint128 rewardRate,
        uint128 bonusRewardRate,
        address multiplierToken,
        Levels calldata levels
    ) external returns (address virtualPool);

    function addRewards(
        IncentiveKey memory key,
        uint256 rewardAmount,
        uint256 bonusRewardAmount
    ) external;

    function setRates(
        IncentiveKey memory key,
        uint128 rewardRate,
        uint128 bonusRewardRate
    ) external;

    function enterFarming(
        IncentiveKey memory key,
        uint256 tokenId,
        uint256 tokensLocked
    ) external;

    function collectRewards(
        IncentiveKey memory key,
        uint256 tokenId,
        address _owner
    ) external returns (uint256 reward, uint256 bonusReward);

    /// @notice Event emitted when a Algebra LP token has been farmd
    /// @param tokenId The unique identifier of an Algebra LP token
    /// @param liquidity The amount of liquidity farmd
    /// @param incentiveId The incentive in which the token is farming
    event FarmStarted(uint256 indexed tokenId, bytes32 indexed incentiveId, uint128 liquidity, uint256 tokensLocked);

    /// @notice Event emitted when a liquidity mining incentive has been created
    /// @param rewardToken The token being distributed as a reward
    /// @param bonusRewardToken The token being distributed as a bonus reward
    /// @param pool The Algebra pool
    /// @param virtualPool The virtual pool address
    /// @param startTime The time when the incentive program begins
    /// @param endTime The time when rewards stop accruing
    /// @param reward The amount of reward tokens to be distributed
    /// @param bonusReward The amount of bonus reward tokens to be distributed
    event IncentiveCreated(
        IERC20Minimal indexed rewardToken,
        IERC20Minimal indexed bonusRewardToken,
        IAlgebraPool indexed pool,
        address virtualPool,
        uint256 startTime,
        uint256 endTime,
        uint256 reward,
        uint256 bonusReward,
        Levels levels,
        address multiplierToken
    );
}
