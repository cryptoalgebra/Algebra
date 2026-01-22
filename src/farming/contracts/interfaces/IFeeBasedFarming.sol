// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';

/// @title Interface for fee-based farming
/// @notice Fee-based farming distributes rewards proportionally to the fees earned by positions
/// @dev Rewards are calculated based on position's share of total accumulated fees during the farming period
interface IFeeBasedFarming {
    /// @notice Emitted when a position enters farming
    /// @param pool The pool address
    /// @param owner The position owner
    /// @param bottomTick The lower tick of the position
    /// @param topTick The upper tick of the position
    /// @param liquidity The position liquidity at entry
    /// @param feeGrowthInside0AtEntry The feeGrowthInside0 at entry time
    /// @param accumulatedFees0AtEntry The pool's accumulatedFees0 at entry time
    event PositionEntered(
        address indexed pool,
        address indexed owner,
        int24 bottomTick,
        int24 topTick,
        uint128 liquidity,
        uint256 feeGrowthInside0AtEntry,
        uint256 accumulatedFees0AtEntry
    );

    /// @notice Emitted when a position exits farming
    /// @param pool The pool address
    /// @param owner The position owner
    /// @param bottomTick The lower tick of the position
    /// @param topTick The upper tick of the position
    /// @param feesEarned The fees earned by this position during farming
    /// @param rewardEarned The reward earned by this position
    event PositionExited(
        address indexed pool,
        address indexed owner,
        int24 bottomTick,
        int24 topTick,
        uint256 feesEarned,
        uint256 rewardEarned
    );

    /// @notice Emitted when rewards are added to the farming
    /// @param pool The pool address
    /// @param rewardToken The reward token address
    /// @param rewardRate The new reward rate (tokens per second)
    /// @param duration The duration in seconds for this reward rate
    event RewardsAdded(
        address indexed pool,
        address indexed rewardToken,
        uint256 rewardRate,
        uint256 duration
    );

    /// @notice Structure representing a farming position
    struct FarmingPosition {
        uint128 liquidity;                    // Position liquidity at entry
        uint256 feeGrowthInside0AtEntry;      // feeGrowthInside0 when position entered
        uint256 accumulatedFees0AtEntry;      // Pool's accumulatedFees0 when position entered
        uint256 entryTimestamp;               // Timestamp when position entered
    }

    /// @notice Structure representing farming configuration for a pool
    struct FarmingConfig {
        address rewardToken;                  // Token used for rewards
        uint256 rewardRate;                   // Reward tokens per second
        uint256 rewardEndTime;                // When rewards stop being distributed
        uint256 totalRewardsDistributed;      // Total rewards distributed so far
        uint256 lastUpdateTime;               // Last time rewards were updated
        uint256 accumulatedFees0AtLastUpdate; // accumulatedFees0 at last update
    }

    /// @notice Returns the farming position data for a given position
    /// @param pool The pool address
    /// @param owner The position owner
    /// @param bottomTick The lower tick of the position
    /// @param topTick The upper tick of the position
    /// @return position The farming position data
    function farmingPositions(
        address pool,
        address owner,
        int24 bottomTick,
        int24 topTick
    ) external view returns (FarmingPosition memory position);

    /// @notice Returns the farming configuration for a pool
    /// @param pool The pool address
    /// @return config The farming configuration
    function farmingConfigs(address pool) external view returns (FarmingConfig memory config);

    /// @notice Calculates the pending reward for a position
    /// @param pool The pool address
    /// @param owner The position owner
    /// @param bottomTick The lower tick of the position
    /// @param topTick The upper tick of the position
    /// @return pendingReward The pending reward amount
    /// @return feesEarned The fees earned by this position since entry
    function pendingReward(
        address pool,
        address owner,
        int24 bottomTick,
        int24 topTick
    ) external view returns (uint256 pendingReward, uint256 feesEarned);

    /// @notice Enters a position into farming
    /// @dev Called automatically when positions are created (if auto-farming is enabled)
    /// @param pool The pool address
    /// @param owner The position owner
    /// @param bottomTick The lower tick of the position
    /// @param topTick The upper tick of the position
    function enterFarming(
        address pool,
        address owner,
        int24 bottomTick,
        int24 topTick
    ) external;

    /// @notice Exits a position from farming and claims rewards
    /// @param pool The pool address
    /// @param owner The position owner
    /// @param bottomTick The lower tick of the position
    /// @param topTick The upper tick of the position
    /// @return reward The reward amount claimed
    function exitFarming(
        address pool,
        address owner,
        int24 bottomTick,
        int24 topTick
    ) external returns (uint256 reward);

    /// @notice Claims pending rewards without exiting farming
    /// @param pool The pool address
    /// @param owner The position owner
    /// @param bottomTick The lower tick of the position
    /// @param topTick The upper tick of the position
    /// @return reward The reward amount claimed
    function claimReward(
        address pool,
        address owner,
        int24 bottomTick,
        int24 topTick
    ) external returns (uint256 reward);

    /// @notice Sets up farming rewards for a pool
    /// @dev Only callable by authorized roles
    /// @param pool The pool address
    /// @param rewardToken The reward token address
    /// @param rewardAmount Total reward amount to distribute
    /// @param duration Duration in seconds over which to distribute rewards
    function setupFarming(
        address pool,
        address rewardToken,
        uint256 rewardAmount,
        uint256 duration
    ) external;

    /// @notice Adds additional rewards to an existing farming
    /// @param pool The pool address
    /// @param rewardAmount Additional reward amount
    /// @param additionalDuration Additional duration in seconds
    function addRewards(
        address pool,
        uint256 rewardAmount,
        uint256 additionalDuration
    ) external;
}
