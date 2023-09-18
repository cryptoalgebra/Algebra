// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/libraries/TickTree.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/TickManagement.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/TickMath.sol';
import '../../lens/TickLens.sol';

contract TickLensEchidnaTest {
    using TickManagement for mapping(int24 => TickManagement.Tick);

    address private tickLens;

    mapping(int24 => TickManagement.Tick) public ticks;

    uint32 public tickTreeRoot; // The root bitmap of search tree
    mapping(int16 => uint256) public tickTreeSecondLayer; // The second layer of search tree
    mapping(int16 => uint256) public tickTable; // leafs of search tree

    constructor() {
        tickLens = address(new TickLens());
        ticks.initTickState();
    }

    function toggleTick(int24 tick) external {
        tick = _boundTick(tick);

        tickTreeRoot = TickTree.toggleTick(tickTable, tickTreeSecondLayer, tickTreeRoot, tick);

        if (ticks[tick].prevTick == ticks[tick].nextTick) {
            int24 nextTick = TickTree.getNextTick(tickTable, tickTreeSecondLayer, tickTreeRoot, tick);
            int24 prevTick = ticks[nextTick].prevTick;

            ticks.insertTick(tick, prevTick, nextTick);
        } else {
            ticks.removeTick(tick);
        }
    }

    function checkNextTickAssertions(int24 targetTick) external view {
        targetTick = _boundTick(targetTick);

        TickLens.PopulatedTick[2] memory populatedTicks = TickLens(tickLens).getClosestActiveTicks(
            address(this),
            targetTick
        );

        assert(populatedTicks[0].tick <= targetTick);
        assert(populatedTicks[1].tick > targetTick);

        int24 nextTick = TickTree.getNextTick(tickTable, tickTreeSecondLayer, tickTreeRoot, targetTick);
        assert(nextTick == populatedTicks[1].tick);

        assert(ticks[populatedTicks[0].tick].nextTick == nextTick);
        assert(ticks[nextTick].prevTick == populatedTicks[0].tick);
    }

    function _boundTick(int24 tick) private pure returns (int24) {
        if (tick >= TickMath.MAX_TICK) tick = TickMath.MAX_TICK - 1;
        if (tick <= TickMath.MIN_TICK) tick = TickMath.MIN_TICK + 1;
        return tick;
    }
}
