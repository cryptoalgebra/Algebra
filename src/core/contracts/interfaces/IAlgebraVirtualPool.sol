// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

interface IAlgebraVirtualPool {
    function cross(int24 nextTick, bool zeroForOne) external;

    function finish(uint32 _endTimestamp, uint32 startTimestamp) external;

    function processSwap() external;

    function increaseCumulative(uint32 previousTimestamp, uint32 currentTimestamp) external;
}
