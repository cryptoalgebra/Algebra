// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import 'algebra/contracts/libraries/FullMath.sol';

/// @title Math for computing rewards
/// @notice Allows computing rewards given some parameters of farms and incentives
library RewardMath {
    /// @notice Compute the amount of rewards owed given parameters of the incentive and farm
    /// @param totalReward The total amount of rewards
    /// @param activeTime Time of active incentive rewards distribution
    /// @param liquidity The amount of liquidity, assumed to be constant over the period over which the snapshots are measured
    /// @param totalLiquidity The amount of liquidity of all positions participating in the incentive
    /// @param secondsPerLiquidityInsideX128 The seconds per liquidity of the liquidity tick range as of the current block timestamp
    /// @return reward The amount of rewards owed
    function computeRewardAmount(
        uint256 totalReward,
        uint256 activeTime,
        uint128 liquidity,
        uint224 totalLiquidity,
        uint160 secondsPerLiquidityInsideX128
    ) internal pure returns (uint256 reward) {
        // this operation is safe, as the difference cannot be greater than 1/deposit.liquidity
        uint256 secondsInsideX128 = secondsPerLiquidityInsideX128 * liquidity;

        if (activeTime == 0) {
            reward = FullMath.mulDiv(totalReward, liquidity, totalLiquidity); // liquidity <= totalLiquidity
        } else {
            // reward less than uint256, as secondsInsideX128 cannot be greater than (activeTime) << 128
            reward = FullMath.mulDiv(totalReward, secondsInsideX128, (activeTime) << 128);
        }
    }
}
