// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.17;

library VirtualPoolConstants {
    uint8 internal constant RESOLUTION = 96;
    uint256 internal constant Q64 = 1 << 64;
    uint256 internal constant Q96 = 1 << 96;
    uint256 internal constant Q128 = 1 << 128;
    int256 internal constant Q160 = 1 << 160;

    int24 internal constant TICK_SPACING = 1;

    // max(uint128) / ( (MAX_TICK - MIN_TICK) )
    uint128 internal constant MAX_LIQUIDITY_PER_TICK = 40564824043007195767232224305152;
}
