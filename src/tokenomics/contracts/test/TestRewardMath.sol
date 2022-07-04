// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '../interfaces/IAlgebraFarming.sol';

import '../libraries/RewardMath.sol';

/// @dev Test contract for RewardMatrh
contract TestRewardMath {
    function computeRewardAmount(
        uint256 totalReward,
        uint256 startTime,
        uint256 endTime,
        uint128 liquidity,
        uint224 totalLiquidity,
        uint160 secondsPerLiquidityInsideX128
    ) public pure returns (uint256 reward) {
        reward = RewardMath.computeRewardAmount(
            totalReward,
            endTime - startTime,
            liquidity,
            totalLiquidity,
            secondsPerLiquidityInsideX128
        );
    }
}
