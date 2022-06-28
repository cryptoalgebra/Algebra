// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import 'algebra/contracts/libraries/FullMath.sol';

/// @title Math for computing rewards
/// @notice Allows computing rewards given some parameters of farms and incentives
library RewardMath {
    /// @notice Compute the amount of rewards owed given parameters of the incentive and farm
    /// @param totalReward The total amount of rewards
    /// @param initTime Start of the incentive rewards distribution
    /// @param endTime When rewards are no longer being dripped out in epoch seconds
    /// @param liquidity The amount of liquidity, assumed to be constant over the period over which the snapshots are measured
    /// @param totalLiquidity The amount of liquidity of all positions participating in the incentive
    /// @param secondsPerLiquidityInsideX128 The seconds per liquidity of the liquidity tick range as of the current block timestamp
    /// @return reward The amount of rewards owed
    function computeRewardAmount(
        uint256 totalReward,
        uint256 initTime,
        uint256 endTime,
        uint128 liquidity,
        uint224 totalLiquidity,
        uint160 secondsPerLiquidityInsideX128
    ) internal pure returns (uint256 reward) {
        // this operation is safe, as the difference cannot be greater than 1/deposit.liquidity
        uint256 secondsInsideX128 = secondsPerLiquidityInsideX128 * liquidity;

        if (endTime - initTime == 0) {
            // liquidity <= totalLiquidity
            reward = FullMath.mulDiv(totalReward, liquidity, totalLiquidity);
        } else {
            // reward less than uint256, as secondsInsideX128 cannot be greater (than endTime - initTime) << 128
            reward = FullMath.mulDiv(totalReward, secondsInsideX128, (endTime - initTime) << 128);
        }
    }
}
