// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';

import './PositionKey.sol';

/// @title Implements commonly used interactions with Algebra pool
library PoolInteraction {
    function _getPositionInPool(
        IAlgebraPool pool,
        address owner,
        int24 tickLower,
        int24 tickUpper
    )
        internal
        view
        returns (
            uint256 liquidityAmount,
            uint256 innerFeeGrowth0Token,
            uint256 innerFeeGrowth1Token,
            uint128 fees0,
            uint128 fees1
        )
    {
        bytes32 positionKey = PositionKey.compute(owner, tickLower, tickUpper);
        return pool.positions(positionKey);
    }

    function _getSqrtPrice(IAlgebraPool pool) internal view returns (uint160 sqrtPriceX96) {
        (sqrtPriceX96, , , , , ) = pool.globalState();
    }

    function _burnPositionInPool(
        IAlgebraPool pool,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) internal returns (uint256 amount0, uint256 amount1) {
        return pool.burn(tickLower, tickUpper, liquidity, '0x0');
    }
}
