// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '../../IAlgebraVirtualPoolBase.sol';

interface IAlgebraIncentiveVirtualPool is IAlgebraVirtualPoolBase {
    // The timestamp when the active incentive is finished
    function desiredEndTimestamp() external returns (uint32);

    // The first swap after this timestamp is going to initialize the virtual pool
    function desiredStartTimestamp() external returns (uint32);

    // returns the timestamp when the incentive was actually finished
    function endTimestamp() external returns (uint32);

    function getFinalStats() external view returns (uint32 endTime, uint32 secondsOutside);

    /**
     * @dev This function is called by a tokenomics when someone calls #exitFarming() after the end timestampю
     * desiredStartTimestamp will be used as initTimestamp if there were no swaps through the entire incentive
     */
    function finish() external;
}
