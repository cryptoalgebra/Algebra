// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.17;

import '@cryptoalgebra/core/contracts/interfaces/IAlgebraVirtualPool.sol';

/// @title Base interface for virtual pools
interface IAlgebraVirtualPoolBase is IAlgebraVirtualPool {
    // returns data associated with a tick
    function ticks(
        int24 tickId
    )
        external
        view
        returns (
            uint128 liquidityTotal,
            int128 liquidityDelta,
            uint256 outerFeeGrowth0Token,
            uint256 outerFeeGrowth1Token,
            int24 prevTick,
            int24 nextTick,
            uint160 outerSecondsPerLiquidity
        );

    // returns the current liquidity in virtual pool
    function currentLiquidity() external view returns (uint128);

    // returns the current tick in virtual pool
    function globalTick() external view returns (int24);

    // returns the timestamp after previous swap (like the last timepoint in a default pool)
    function prevTimestamp() external view returns (uint32);

    /**
     * @dev This function is called when anyone farms their liquidity. The position in a virtual pool
     * should be changed accordingly
     * @param currentTimestamp The timestamp of current block
     * @param bottomTick The bottom tick of a position
     * @param topTick The top tick of a position
     * @param liquidityDelta The amount of liquidity in a position
     * @param currentTick The current tick in the main pool
     */
    function applyLiquidityDeltaToPosition(
        uint32 currentTimestamp,
        int24 bottomTick,
        int24 topTick,
        int128 liquidityDelta,
        int24 currentTick
    ) external;

    /**
     * @dev This function is called from the main pool before every swap To increase seconds per liquidity
     * cumulative considering previous timestamp and liquidity. The liquidity is stored in a virtual pool
     * @param currentTimestamp The timestamp of the current swap
     */
    function increaseCumulative(uint32 currentTimestamp) external;
}
