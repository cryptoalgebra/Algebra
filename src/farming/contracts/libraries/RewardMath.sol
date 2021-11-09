// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import 'algebra/contracts/libraries/FullMath.sol';
import '@openzeppelin/contracts/math/Math.sol';

/// @title Math for computing rewards
/// @notice Allows computing rewards given some parameters of farms and incentives
library RewardMath {
    /// @notice Compute the amount of rewards owed given parameters of the incentive and farm
    /// @param totalReward The total amount of unclaimed rewards left for an incentive
    /// @param startTime When the incentive rewards began in epoch seconds
    /// @param endTime When rewards are no longer being dripped out in epoch seconds
    /// @param liquidity The amount of liquidity, assumed to be constant over the period over which the snapshots are measured
    /// @param secondsPerLiquidityInsideX128 The seconds per liquidity of the liquidity tick range as of the current block timestamp
    /// @return reward The amount of rewards owed
    function computeRewardAmount(
        uint256 totalReward,
        uint256 startTime,
        uint256 endTime,
        uint128 liquidity,
        uint224 totalLiquidity,
        uint160 secondsPerLiquidityInsideX128
    ) internal pure returns (uint256 reward) {
        // this operation is safe, as the difference cannot be greater than 1/farm.liquidity
        uint256 secondsInsideX128 = secondsPerLiquidityInsideX128 * liquidity;

        if (endTime - startTime == 0) {
            reward = FullMath.mulDiv(totalReward, liquidity, totalLiquidity);
        } else {
            reward = FullMath.mulDiv(totalReward, secondsInsideX128, (endTime - startTime) << 128);
        }
    }
}
