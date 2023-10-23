// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;
pragma abicoder v2;

import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import '../lens/TickLens.sol';

/// @title Tick Lens contract
contract TickLensTest is TickLens {
    function getGasCostOfGetPopulatedTicksInWord(address pool, int16 tickTableIndex) external view returns (uint256) {
        uint256 gasBefore = gasleft();
        getPopulatedTicksInWord(pool, tickTableIndex);
        return gasBefore - gasleft();
    }

    function getGasCostOfGetNextActiveTicks(
        address pool,
        int24 startingTick,
        uint256 amount,
        bool upperDirection
    ) external view returns (uint256) {
        uint256 gasBefore = gasleft();
        getNextActiveTicks(pool, startingTick, amount, upperDirection);
        return gasBefore - gasleft();
    }

    function getGasCostOfGetClosestActiveTicks(address pool, int24 targetTick) external view returns (uint256) {
        uint256 gasBefore = gasleft();
        getClosestActiveTicks(pool, targetTick);
        return gasBefore - gasleft();
    }
}
