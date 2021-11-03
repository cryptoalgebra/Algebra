// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import 'algebra/contracts/interfaces/IAlgebraPool.sol';
import './PoolAddress.sol';

/// @notice Provides validation for callbacks from Algebra Pools
library CallbackValidation {
    /// @notice Returns the address of a valid Algebra Pool
    /// @param factory The contract address of the Algebra factory
    /// @param tokenA The contract address of either token0 or token1
    /// @param tokenB The contract address of the other token
    /// @return pool The V3 pool contract address
    function verifyCallback(
        address factory,
        address tokenA,
        address tokenB
    ) internal view returns (IAlgebraPool pool) {
        return verifyCallback(factory, PoolAddress.getPoolKey(tokenA, tokenB));
    }

    /// @notice Returns the address of a valid Algebra Pool
    /// @param factory The contract address of the Algebra factory
    /// @param poolKey The identifying key of the V3 pool
    /// @return pool The V3 pool contract address
    function verifyCallback(address factory, PoolAddress.PoolKey memory poolKey)
        internal
        view
        returns (IAlgebraPool pool)
    {
        pool = IAlgebraPool(PoolAddress.computeAddress(factory, poolKey));
        require(msg.sender == address(pool));
    }
}
