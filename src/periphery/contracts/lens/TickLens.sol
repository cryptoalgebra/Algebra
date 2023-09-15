// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

import '@cryptoalgebra/core/contracts/interfaces/IAlgebraPool.sol';

import '../interfaces/ITickLens.sol';

/// @title Tick Lens contract
/// @dev Credit to Uniswap Labs under GPL-2.0-or-later license:
/// https://github.com/Uniswap/v3-periphery
contract TickLens is ITickLens {
    /// @inheritdoc ITickLens
    function getPopulatedTicksInWord(
        address pool,
        int16 tickTableIndex
    ) public view override returns (PopulatedTick[] memory populatedTicks) {
        // fetch bitmap
        uint256 bitmap = IAlgebraPool(pool).tickTable(tickTableIndex);
        unchecked {
            // calculate the number of populated ticks
            uint256 numberOfPopulatedTicks;
            for (uint256 i = 0; i < 256; i++) {
                if (bitmap & (1 << i) > 0) numberOfPopulatedTicks++;
            }

            // fetch populated tick data
            populatedTicks = new PopulatedTick[](numberOfPopulatedTicks);
            for (uint256 i = 0; i < 256; i++) {
                if (bitmap & (1 << i) > 0) {
                    int24 populatedTick = ((int24(tickTableIndex) << 8) + int24(uint24(i)));
                    (uint256 liquidityGross, int128 liquidityNet, , , , ) = IAlgebraPool(pool).ticks(populatedTick);
                    populatedTicks[--numberOfPopulatedTicks] = PopulatedTick({
                        tick: populatedTick,
                        liquidityNet: liquidityNet,
                        liquidityGross: uint128(liquidityGross)
                    });
                }
            }
        }
    }

    /// @inheritdoc ITickLens
    function getNextActiveTicks(
        address pool,
        int24 startingTick,
        uint256 amount,
        bool upperDirection
    ) public view override returns (PopulatedTick[] memory populatedTicks) {
        int24 currentTick = startingTick;

        populatedTicks = new PopulatedTick[](amount);

        (uint256 liquidityGross, int128 liquidityNet, int24 previousTick, int24 nextTick, , ) = IAlgebraPool(pool)
            .ticks(currentTick);
        require(previousTick != nextTick, 'Invalid startingTick');

        unchecked {
            for (uint256 i = 0; i < amount; i++) {
                populatedTicks[i] = PopulatedTick({
                    tick: currentTick,
                    liquidityNet: liquidityNet,
                    liquidityGross: uint128(liquidityGross)
                });

                int24 newCurrentTick = upperDirection ? nextTick : previousTick;
                if (newCurrentTick == currentTick) {
                    // reached MAX or MIN tick
                    break;
                }
                currentTick = newCurrentTick;

                (liquidityGross, liquidityNet, previousTick, nextTick, , ) = IAlgebraPool(pool).ticks(currentTick);
            }
        }
    }
}
