// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/TickTree.sol';

import '../interfaces/ITickLens.sol';

/// @title Algebra Integral 1.0 Tick Lens contract
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
    function getClosestActiveTicks(
        address pool,
        int24 targetTick
    ) public view override returns (PopulatedTick[2] memory populatedTicks) {
        uint32 tickTreeRoot = IAlgebraPool(pool).tickTreeRoot();

        uint16 rootIndex = uint16(uint24((int24(targetTick >> 8) + TickTree.SECOND_LAYER_OFFSET) >> 8));

        int24 activeTickIndex;
        bool initialized;

        if ((1 << rootIndex) & tickTreeRoot != 0) {
            uint256 leafNode = _fetchBitmap(pool, int16(targetTick >> 8));

            (activeTickIndex, initialized) = TickTree._nextActiveBitInWord(leafNode, targetTick);

            if (!initialized) {
                int16 secondLayerIndex = int16((targetTick >> 8) + int24(TickTree.SECOND_LAYER_OFFSET) + 1);
                uint256 secondLayerNode = _fetchSecondLayerNode(pool, secondLayerIndex >> 8);
                (int24 activeLeafIndex, bool initializedSecondLayer) = TickTree._nextActiveBitInWord(
                    secondLayerNode,
                    secondLayerIndex
                );

                if (initializedSecondLayer) {
                    int24 nextTickIndex = int24(activeLeafIndex - TickTree.SECOND_LAYER_OFFSET) << 8;
                    leafNode = _fetchBitmap(pool, int16(activeLeafIndex - TickTree.SECOND_LAYER_OFFSET));
                    (activeTickIndex, initialized) = TickTree._nextActiveBitInWord(leafNode, nextTickIndex);
                } else {
                    rootIndex++;
                }
            }
        }

        if (!initialized) {
            (int24 nextActiveSecondLayerNode, ) = TickTree._nextActiveBitInWord(tickTreeRoot, int16(rootIndex));
            uint256 secondLayerNode = _fetchSecondLayerNode(pool, int16(nextActiveSecondLayerNode));

            (int24 activeLeafIndex, bool initializedSecondLayer) = TickTree._nextActiveBitInWord(
                secondLayerNode,
                int24(nextActiveSecondLayerNode) << 8
            );
            if (initializedSecondLayer) {
                uint256 leafNode = _fetchBitmap(pool, int16(activeLeafIndex - TickTree.SECOND_LAYER_OFFSET));

                (activeTickIndex, ) = TickTree._nextActiveBitInWord(
                    leafNode,
                    int24(activeLeafIndex - TickTree.SECOND_LAYER_OFFSET) << 8
                );
            } else {
                activeTickIndex = TickMath.MAX_TICK;
            }
        }

        if (activeTickIndex == targetTick) {
            (uint256 liquidityGross, int128 liquidityNet, , int24 nextTick) = _getTick(pool, targetTick);
            populatedTicks[0] = PopulatedTick({
                tick: targetTick,
                liquidityNet: liquidityNet,
                liquidityGross: uint128(liquidityGross)
            });

            (liquidityGross, liquidityNet, , ) = _getTick(pool, nextTick);

            populatedTicks[1] = PopulatedTick({
                tick: nextTick,
                liquidityNet: liquidityNet,
                liquidityGross: uint128(liquidityGross)
            });
        } else {
            (uint256 liquidityGross, int128 liquidityNet, int24 previousTick, ) = _getTick(pool, activeTickIndex);
            populatedTicks[1] = PopulatedTick({
                tick: activeTickIndex,
                liquidityNet: liquidityNet,
                liquidityGross: uint128(liquidityGross)
            });

            (liquidityGross, liquidityNet, , ) = _getTick(pool, previousTick);

            populatedTicks[0] = PopulatedTick({
                tick: previousTick,
                liquidityNet: liquidityNet,
                liquidityGross: uint128(liquidityGross)
            });
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

        // prevent pointers from being initialized
        // if we initialize the populatedTicks array directly, it will automatically write `amount` pointers to structs in array
        bytes32[] memory populatedTicksPointers = new bytes32[](amount);
        assembly {
            populatedTicks := populatedTicksPointers
        }

        (uint256 liquidityGross, int128 liquidityNet, int24 previousTick, int24 nextTick, , ) = IAlgebraPool(pool)
            .ticks(currentTick);
        require(previousTick != nextTick, 'Invalid startingTick');

        bytes32 freeMemoryPointer;
        assembly {
            freeMemoryPointer := mload(0x40)
        }
        unchecked {
            for (uint256 i; i < amount; ++i) {
                // allocate memory for new struct and set it without rewriting free memory pointer
                assembly {
                    mstore(freeMemoryPointer, currentTick)
                    mstore(add(freeMemoryPointer, 0x20), liquidityNet)
                    mstore(add(freeMemoryPointer, 0x40), liquidityGross)
                }

                // prevent array length check and store new pointer in array
                assembly {
                    mstore(add(mul(i, 0x20), add(populatedTicks, 0x20)), freeMemoryPointer)
                    freeMemoryPointer := add(freeMemoryPointer, 0x60)
                }

                int24 newCurrentTick = upperDirection ? nextTick : previousTick;
                if (newCurrentTick == currentTick) {
                    // reached MAX or MIN tick
                    assembly {
                        mstore(populatedTicks, add(i, 1)) // cap returning array length
                    }
                    break;
                }
                currentTick = newCurrentTick;
                (liquidityGross, liquidityNet, previousTick, nextTick) = _getTick(pool, currentTick);
            }
        }
        assembly {
            mstore(0x40, freeMemoryPointer) // rewrite free memory pointer slot
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

    function _fetchSecondLayerNode(address pool, int16 index) internal view virtual returns (uint256 word) {
        assembly {
            mstore(0x00, 0xd861903700000000000000000000000000000000000000000000000000000000) // "tickTreeSecondLayer(int16)" selector
            mstore(0x04, index)
            let success := staticcall(gas(), pool, 0, 0x24, 0, 0x20)
            word := mload(0)
        }
    }
}
