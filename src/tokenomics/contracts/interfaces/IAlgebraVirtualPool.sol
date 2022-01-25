// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

interface IAlgebraVirtualPool {
    // returns the timestamp of the first swap after start timestamp
    function initTimestamp() external returns (uint32);

    // returns the timestamp when the incentive was actually finished
    function endTimestamp() external returns (uint32);

    // returns how much time the price was out of any farmd liquidity
    function timeOutside() external returns (uint32);

    // returns total seconds per farmd liquidity from the moment of initialization of the virtual pool
    function globalSecondsPerLiquidityCumulative() external returns (uint160);

    // returns the current liquidity in virtual pool
    function currentLiquidity() external returns (uint128);

    // returns the current tick in virtual pool
    function globalTick() external returns (int24);

    // returns the liquidity after previous swap (like the last timepoint in a default pool)
    function prevLiquidity() external returns (uint128);

    // returns the timestamp after previous swap (like the last timepoint in a default pool)
    function _prevTimestamp() external returns (uint32);

    // returns data associated with a tick
    function ticks(int24 tickId)
        external
        returns (
            uint128 liquidityTotal,
            int128 liquidityDelta,
            uint256 outerFeeGrowth0Token,
            uint256 outerFeeGrowth1Token,
            int56 outerTickCumulative,
            uint160 outerSecondsPerLiquidity,
            uint32 outerSecondsSpent,
            bool initialized
        );

    /**
     * @dev This function is called when anyone farms their liquidity. The position in a virtual pool
     * should be changed accordingly
     * @param bottomTick The bottom tick of a position
     * @param topTick The top tick of a position
     * @param liquidityDelta The amount of liquidity in a position
     * @param tick The current tick in the main pool
     */
    function applyLiquidityDeltaToPosition(
        int24 bottomTick,
        int24 topTick,
        int128 liquidityDelta,
        int24 tick
    ) external;

    /**
     * @dev This function is called by the main pool when an initialized tick is crossed there.
     * If the tick is also initialized in a virtual pool it should ne crossed too
     * @param nextTick The crossed tick
     * @param zeroForOne The direction
     */
    function cross(int24 nextTick, bool zeroForOne) external;

    /**
     * @dev This function is called by a tokenomics when someone calls #exitFarming() after the end timestamp
     * @param _endTimestamp The timestamp of the exitFarming
     * @param startTime The timestamp of planned start of the incentive. Used as initTimestamp
     * if there were no swaps through the entire incentive
     */
    function finish(uint32 _endTimestamp, uint32 startTime) external;

    /**
     * @dev This function is used to calculate the seconds per liquidity inside a certain position
     * @param bottomTick The bottom tick of a position
     * @param topTick The top tick of a position
     * @return innerSecondsSpentPerLiquidity The seconds per liquidity inside the position
     * @return initTime the #initTimestamp
     * @return endTime the #endTimestamp
     */
    function getInnerSecondsPerLiquidity(int24 bottomTick, int24 topTick)
        external
        view
        returns (
            uint160 innerSecondsSpentPerLiquidity,
            uint32 initTime,
            uint32 endTime
        );

    // This function updates the #prevLiquidity
    function processSwap() external;

    /**
     * @dev This function is called from the main pool before every swap To increase seconds per liquidity
     * cumulative considering previous timestamp and liquidity. The liquidity is stored in a virtual pool
     * @param previousTimestamp The timestamp of the previous swap
     * @param currentTimestamp The timestamp of the current swap
     */
    function increaseCumulative(uint32 previousTimestamp, uint32 currentTimestamp) external;
}
