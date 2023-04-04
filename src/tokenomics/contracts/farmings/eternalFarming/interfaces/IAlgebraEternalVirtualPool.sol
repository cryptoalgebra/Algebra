// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.17;

import '../../../base/IAlgebraVirtualPoolBase.sol';

interface IAlgebraEternalVirtualPool is IAlgebraVirtualPoolBase {
    /// @notice Change reward rates
    /// @param rate0 The new rate of main token distribution per sec
    /// @param rate1 The new rate of bonus token distribution per sec
    function setRates(uint128 rate0, uint128 rate1) external;

    function addRewards(uint128 token0Amount, uint128 token1Amount) external;

    function decreaseRewards(uint128 token0Amount, uint128 token1Amount) external;

    function getInnerRewardsGrowth(
        int24 bottomTick,
        int24 topTick
    ) external view returns (uint256 rewardGrowthInside0, uint256 rewardGrowthInside1);

    function rewardReserves() external view returns (uint128 reserve0, uint128 reserve1);

    function rewardRates() external view returns (uint128 rate0, uint128 rate1);
}
