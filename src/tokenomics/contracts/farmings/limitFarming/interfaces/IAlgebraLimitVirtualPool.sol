// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '../../IAlgebraVirtualPoolBase.sol';

interface IAlgebraLimitVirtualPool is IAlgebraVirtualPoolBase {
    // The timestamp when the active incentive is finished
    function desiredEndTimestamp() external view returns (uint32);

    // The first swap after this timestamp is going to initialize the virtual pool
    function desiredStartTimestamp() external view returns (uint32);

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
