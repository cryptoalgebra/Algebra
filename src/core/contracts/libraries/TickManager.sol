// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

import './LowGasSafeMath.sol';
import './SafeCast.sol';

import './TickMath.sol';
import './LiquidityMath.sol';

/// @title TickManager
/// @notice Contains functions for managing tick processes and relevant calculations
library TickManager {
    using LowGasSafeMath for int256;
    using SafeCast for int256;

    // info stored for each initialized individual tick
    struct Tick {
        // the total position liquidity that references this tick
        uint128 liquidityTotal;
        // amount of net liquidity added (subtracted) when tick is crossed from left to right (right to left),
        int128 liquidityDelta;
        // fee growth per unit of liquidity on the _other_ side of this tick (relative to the current tick)
        // only has relative meaning, not absolute — the value depends on when the tick is initialized
        uint256 outerFeeGrowth0Token;
        uint256 outerFeeGrowth1Token;
        // the cumulative tick value on the other side of the tick
        int56 outerTickCumulative;
        // the seconds per unit of liquidity on the _other_ side of this tick (relative to the current tick)
        // only has relative meaning, not absolute — the value depends on when the tick is initialized
        uint160 outerSecondsPerLiquidity;
        // the seconds spent on the other side of the tick (relative to the current tick)
        // only has relative meaning, not absolute — the value depends on when the tick is initialized
        uint32 outerSecondsSpent;
        // true iff the tick is initialized, i.e. the value is exactly equivalent to the expression liquidityTotal != 0
        // these 8 bits are set to prevent fresh sstores when crossing newly initialized ticks
        bool initialized;
    }

    /// @notice Retrieves fee growth data
    /// @param self The mapping containing all tick information for initialized ticks
    /// @param bottomTick The lower tick boundary of the position
    /// @param topTick The upper tick boundary of the position
    /// @param currentTick The current tick
    /// @param totalFeeGrowth0Token The all-time global fee growth, per unit of liquidity, in token0
    /// @param totalFeeGrowth1Token The all-time global fee growth, per unit of liquidity, in token1
    /// @return innerFeeGrowth0Token The all-time fee growth in token0, per unit of liquidity, inside the position's tick boundaries
    /// @return innerFeeGrowth1Token The all-time fee growth in token1, per unit of liquidity, inside the position's tick boundaries
    function getInnerFeeGrowth(
        mapping(int24 => Tick) storage self,
        int24 bottomTick,
        int24 topTick,
        int24 currentTick,
        uint256 totalFeeGrowth0Token,
        uint256 totalFeeGrowth1Token
    ) internal view returns (uint256 innerFeeGrowth0Token, uint256 innerFeeGrowth1Token) {
        Tick storage lower = self[bottomTick];
        Tick storage upper = self[topTick];

        if (currentTick < topTick) {
            if (currentTick >= bottomTick) {
                innerFeeGrowth0Token = totalFeeGrowth0Token - lower.outerFeeGrowth0Token;
                innerFeeGrowth1Token = totalFeeGrowth1Token - lower.outerFeeGrowth1Token;
            } else {
                innerFeeGrowth0Token = lower.outerFeeGrowth0Token;
                innerFeeGrowth1Token = lower.outerFeeGrowth1Token;
            }
            innerFeeGrowth0Token -= upper.outerFeeGrowth0Token;
            innerFeeGrowth1Token -= upper.outerFeeGrowth1Token;
        } else {
            innerFeeGrowth0Token = upper.outerFeeGrowth0Token - lower.outerFeeGrowth0Token;
            innerFeeGrowth1Token = upper.outerFeeGrowth1Token - lower.outerFeeGrowth1Token;
        }
    }

    /// @notice Updates a tick and returns true if the tick was flipped from initialized to uninitialized, or vice versa
    /// @param self The mapping containing all tick information for initialized ticks
    /// @param tick The tick that will be updated
    /// @param currentTick The current tick
    /// @param liquidityDelta A new amount of liquidity to be added (subtracted) when tick is crossed from left to right (right to left)
    /// @param totalFeeGrowth0Token The all-time global fee growth, per unit of liquidity, in token0
    /// @param totalFeeGrowth1Token The all-time global fee growth, per unit of liquidity, in token1
    /// @param secondsPerLiquidityCumulative The all-time seconds per max(1, liquidity) of the pool
    /// @param time The current block timestamp cast to a uint32
    /// @param upper true for updating a position's upper tick, or false for updating a position's lower tick
    /// @return flipped Whether the tick was flipped from initialized to uninitialized, or vice versa
    function update(
        mapping(int24 => Tick) storage self,
        int24 tick,
        int24 currentTick,
        int128 liquidityDelta,
        uint256 totalFeeGrowth0Token,
        uint256 totalFeeGrowth1Token,
        uint160 secondsPerLiquidityCumulative,
        int56 tickCumulative,
        uint32 time,
        bool upper
    ) internal returns (bool flipped) {
        Tick storage data = self[tick];

        int128 liquidityDeltaBefore = data.liquidityDelta;
        uint128 liquidityTotalBefore = data.liquidityTotal;

        uint128 liquidityTotalAfter = LiquidityMath.addDelta(liquidityTotalBefore, liquidityDelta);
        require(liquidityTotalAfter <= 11505743598341114571880798222544994, 'LO');
        flipped = (liquidityTotalAfter == 0);

        data.liquidityTotal = liquidityTotalAfter;
        // when the lower (upper) tick is crossed left to right (right to left), liquidity must be added (removed)
        data.liquidityDelta = upper
            ? int256(liquidityDeltaBefore).sub(liquidityDelta).toInt128()
            : int256(liquidityDeltaBefore).add(liquidityDelta).toInt128();

        if (liquidityTotalBefore == 0) {
            flipped = !flipped;
            // by convention, we assume that all growth before a tick was initialized happened _below_ the tick
            if (tick <= currentTick) {
                data.outerFeeGrowth0Token = totalFeeGrowth0Token;
                data.outerFeeGrowth1Token = totalFeeGrowth1Token;
                data.outerSecondsPerLiquidity = secondsPerLiquidityCumulative;
                data.outerTickCumulative = tickCumulative;
                data.outerSecondsSpent = time;
                data.initialized = true;
            } else {
                data.initialized = true;
            }
        }
    }

    /// @notice Transitions to next tick as needed by price movement
    /// @param self The mapping containing all tick information for initialized ticks
    /// @param tick The destination tick of the transition
    /// @param totalFeeGrowth0Token The all-time global fee growth, per unit of liquidity, in token0
    /// @param totalFeeGrowth1Token The all-time global fee growth, per unit of liquidity, in token1
    /// @param secondsPerLiquidityCumulative The current seconds per liquidity
    /// @param time The current block.timestamp
    /// @return liquidityDelta The amount of liquidity added (subtracted) when tick is crossed from left to right (right to left)
    function cross(
        mapping(int24 => Tick) storage self,
        int24 tick,
        uint256 totalFeeGrowth0Token,
        uint256 totalFeeGrowth1Token,
        uint160 secondsPerLiquidityCumulative,
        int56 tickCumulative,
        uint32 time
    ) internal returns (int128 liquidityDelta) {
        Tick storage data = self[tick];

        data.outerFeeGrowth0Token = totalFeeGrowth0Token - data.outerFeeGrowth0Token;
        data.outerFeeGrowth1Token = totalFeeGrowth1Token - data.outerFeeGrowth1Token;

        data.outerSecondsPerLiquidity = secondsPerLiquidityCumulative - data.outerSecondsPerLiquidity;
        data.outerTickCumulative = tickCumulative - data.outerTickCumulative;
        data.outerSecondsSpent = time - data.outerSecondsSpent;

        liquidityDelta = data.liquidityDelta;
    }
}
