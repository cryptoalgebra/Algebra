// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraFactory.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import './PeripheryImmutableState.sol';
import '../interfaces/IPoolInitializer.sol';

import '../libraries/PoolInteraction.sol';

/// @title Creates and initializes Algebra Pools
/// @dev Credit to Uniswap Labs under GPL-2.0-or-later license:
/// https://github.com/Uniswap/v3-periphery
abstract contract PoolInitializer is IPoolInitializer, PeripheryImmutableState {
    using PoolInteraction for IAlgebraPool;

    /// @inheritdoc IPoolInitializer
    function createAndInitializePoolIfNecessary(
        address token0,
        address token1,
        uint160 sqrtPriceX96
    ) external payable override returns (address pool) {
        require(token0 < token1, 'Invalid order of tokens');

        pool = IAlgebraFactory(factory).poolByPair(token0, token1);

        if (pool == address(0)) {
            pool = IAlgebraFactory(factory).createPool(token0, token1);

            _initializePool(pool, sqrtPriceX96);
        } else {
            uint160 sqrtPriceX96Existing = IAlgebraPool(pool)._getSqrtPrice();
            if (sqrtPriceX96Existing == 0) {
                _initializePool(pool, sqrtPriceX96);
            }
        }
    }

    function _initializePool(address pool, uint160 initPrice) private {
        IAlgebraPool(pool).initialize(initPrice);
    }
}
