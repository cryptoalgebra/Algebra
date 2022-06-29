// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '../../IAlgebraVirtualPoolBase.sol';

interface IAlgebraIncentiveVirtualPool is IAlgebraVirtualPoolBase {
    // The timestamp when the active incentive is finished
    function desiredEndTimestamp() external returns (uint32);

    // The first swap after this timestamp is going to initialize the virtual pool
    function desiredStartTimestamp() external returns (uint32);

    // returns the timestamp of the first swap after start timestamp
    function initTimestamp() external returns (uint32);

    // returns the timestamp when the incentive was actually finished
    function endTimestamp() external returns (uint32);

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
}
