// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '../../interfaces/IAlgebraFarming.sol';

/// @title Algebra Farming Interface
/// @notice Allows farming nonfungible liquidity tokens in exchange for reward tokens
interface IAlgebraIncentiveFarming is IAlgebraFarming {
    struct IncentiveParams {
        uint256 reward;
        uint256 bonusReward;
        address multiplierToken;
        uint32 enterStartTime;
    }

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
            int24 tickUpper
        );

    function createIncentive(
        IncentiveKey memory key,
        Levels calldata levels,
        IncentiveParams memory params
    ) external returns (address virtualPool);

    function decreaseRewardsAmount(
        IncentiveKey memory key,
        uint256 rewards,
        uint256 bonusRewards
    ) external;

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
            Levels memory levels
        );

    function enterFarming(
        IncentiveKey memory key,
        uint256 tokenId,
        uint256 tokensLocked
    ) external;

    /// @notice Event emitted when a liquidity mining incentive has been created
    /// @param rewardToken The token being distributed as a reward
    /// @param bonusRewardToken The token being distributed as a bonus reward
    /// @param pool The Algebra pool
    /// @param startTime The time when the incentive program begins
    /// @param endTime The time when rewards stop accruing
    /// @param reward The amount of reward tokens to be distributed
    /// @param bonusReward The amount of bonus reward tokens to be distributed
    event IncentiveCreated(
        IERC20Minimal indexed rewardToken,
        IERC20Minimal indexed bonusRewardToken,
        IAlgebraPool indexed pool,
        uint256 startTime,
        uint256 endTime,
        uint256 reward,
        uint256 bonusReward,
        Levels levels,
        address multiplierToken,
        uint32 enterStartTime
    );
    /// @notice Event emitted when a Algebra LP token has been farmd
    /// @param tokenId The unique identifier of an Algebra LP token
    /// @param liquidity The amount of liquidity farmd
    /// @param incentiveId The incentive in which the token is farming
    /// @param tokensLocked The amount of tokens locked for multiplier
    event FarmStarted(uint256 indexed tokenId, bytes32 indexed incentiveId, uint128 liquidity, uint256 tokensLocked);

    event RewardAmountsDecreased(uint256 reward, uint256 bonusReward, bytes32 incentiveId);
}
