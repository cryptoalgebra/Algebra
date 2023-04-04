// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.17;

import '../../../base/IAlgebraVirtualPoolBase.sol';

interface IAlgebraLimitVirtualPool is IAlgebraVirtualPoolBase {
    /// @notice This function is used to calculate the seconds per liquidity inside a certain position
    /// @param bottomTick The bottom tick of a position
    /// @param topTick The top tick of a position
    /// @return innerSecondsSpentPerLiquidity The seconds per liquidity inside the position
    function getInnerSecondsPerLiquidity(
        int24 bottomTick,
        int24 topTick
    ) external view returns (uint160 innerSecondsSpentPerLiquidity);

    // The timestamp when the active incentive is finished
    function desiredEndTimestamp() external view returns (uint32);

    // The first swap after this timestamp is going to initialize the virtual pool
    function desiredStartTimestamp() external view returns (uint32);

    // returns how much time the price was out of any farmd liquidity
    function timeOutside() external view returns (uint32);

    // returns total seconds per farmd liquidity from the moment of initialization of the virtual pool
    function globalSecondsPerLiquidityCumulative() external view returns (uint160);

    // Is incentive already finished or not
    function isFinished() external view returns (bool);

    /**
     * @notice Finishes incentive if it wasn't
     * @dev This function is called by a AlgebraLimitFarming when someone calls #exitFarming() after the end timestamp
     * @return wasFinished Was incentive finished before this call or not
     * @return activeTime The summary amount of seconds inside active positions
     */
    function finish() external returns (bool wasFinished, uint32 activeTime);
}
