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
                    (uint256 liquidityGross, int128 liquidityNet, , ) = _getTick(pool, populatedTick);
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

                (liquidityGross, liquidityNet, previousTick, nextTick) = _getTick(pool, currentTick);
            }
        }
    }

    // prevents memory expansion during staticcall
    // will use [0x00, 0xC0] memory slots
    function _getTick(
        address pool,
        int24 index
    ) internal view virtual returns (uint128 liquidityGross, int128 liquidityNet, int24 previousTick, int24 nextTick) {
        assembly {
            let freeMemoryPointer := mload(0x40) // we will need to restore memory further
            let slot1 := mload(0x60)
            let slot2 := mload(0x80)
            let slot3 := mload(0xA0)

            mstore(0x00, 0xf30dba9300000000000000000000000000000000000000000000000000000000) // "ticks" selector
            mstore(0x04, index)
            let success := staticcall(gas(), pool, 0, 0x24, 0, 0xC0)
            liquidityGross := mload(0)
            liquidityNet := mload(0x20)
            previousTick := mload(0x40)
            nextTick := mload(0x60)

            mstore(0x40, freeMemoryPointer) // restore memory
            mstore(0x60, slot1)
            mstore(0x80, slot2)
            mstore(0xA0, slot3)
        }
    }

    function _fetchBitmap(address pool, int16 index) internal view virtual returns (uint256 word) {
        assembly {
            mstore(0x00, 0xc677e3e000000000000000000000000000000000000000000000000000000000) // "tickTable(int16)" selector
            mstore(0x04, index)
            let success := staticcall(gas(), pool, 0, 0x24, 0, 0x20)
            word := mload(0)
        }
    }
}
