// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/libraries/SafeCast.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/TickMath.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/callback/IAlgebraSwapCallback.sol';

import '../interfaces/IQuoterV2.sol';
import '../base/PeripheryImmutableState.sol';
import '../libraries/Path.sol';
import '../libraries/PoolAddress.sol';
import '../libraries/CallbackValidation.sol';
import '../libraries/PoolTicksCounter.sol';

/// @title  Algebra Integral 1.0 QuoterV2
/// @notice Allows getting the expected amount out or amount in for a given swap without executing the swap
/// @dev These functions are not gas efficient and should _not_ be called on chain. Instead, optimistically execute
/// the swap and check the amounts in the callback.
/// Credit to Uniswap Labs under GPL-2.0-or-later license:
/// https://github.com/Uniswap/v3-periphery
contract QuoterV2 is IQuoterV2, IAlgebraSwapCallback, PeripheryImmutableState {
    using Path for bytes;
    using SafeCast for uint256;
    using PoolTicksCounter for IAlgebraPool;

    /// @dev Transient storage variable used to check a safety condition in exact output swaps.
    uint256 private amountOutCached;

    constructor(
        address _factory,
        address _WNativeToken,
        address _poolDeployer
    ) PeripheryImmutableState(_factory, _WNativeToken, _poolDeployer) {}

    function getPool(address tokenA, address tokenB) private view returns (IAlgebraPool) {
        return IAlgebraPool(PoolAddress.computeAddress(poolDeployer, PoolAddress.getPoolKey(tokenA, tokenB)));
    }

    /// @inheritdoc IAlgebraSwapCallback
    function algebraSwapCallback(int256 amount0Delta, int256 amount1Delta, bytes memory path) external view override {
        require(amount0Delta > 0 || amount1Delta > 0, 'Zero liquidity swap'); // swaps entirely within 0-liquidity regions are not supported
        (address tokenIn, address tokenOut) = path.decodeFirstPool();
        CallbackValidation.verifyCallback(poolDeployer, tokenIn, tokenOut);

        (bool isExactInput, uint256 amountToPay, uint256 amountReceived) = amount0Delta > 0
            ? (tokenIn < tokenOut, uint256(amount0Delta), uint256(-amount1Delta))
            : (tokenOut < tokenIn, uint256(amount1Delta), uint256(-amount0Delta));

        IAlgebraPool pool = getPool(tokenIn, tokenOut);
        (uint160 sqrtPriceX96After, int24 tickAfter, uint16 fee, , , ) = pool.globalState();

        if (isExactInput) {
            assembly {
                let ptr := mload(0x40)
                mstore(ptr, amountReceived)
                mstore(add(ptr, 0x20), amountToPay)
                mstore(add(ptr, 0x40), sqrtPriceX96After)
                mstore(add(ptr, 0x60), tickAfter)
                mstore(add(ptr, 0x80), fee)
                revert(ptr, 224)
            }
        } else {
            // if the cache has been populated, ensure that the full output amount has been received
            if (amountOutCached != 0) require(amountReceived == amountOutCached, 'Not received full amountOut');
            assembly {
                let ptr := mload(0x40)
                mstore(ptr, amountReceived)
                mstore(add(ptr, 0x20), amountToPay)
                mstore(add(ptr, 0x40), sqrtPriceX96After)
                mstore(add(ptr, 0x60), tickAfter)
                mstore(add(ptr, 0x80), fee)
                revert(ptr, 224)
            }
        }
    }

    /// @dev Parses a revert reason that should contain the numeric quote
    function parseRevertReason(
        bytes memory reason
    )
        private
        pure
        returns (uint256 amountReceived, uint256 amountToPay, uint160 sqrtPriceX96After, int24 tickAfter, uint16 fee)
    {
        if (reason.length != 224) {
            require(reason.length > 0, 'Unexpected error');
            assembly ('memory-safe') {
                revert(add(32, reason), mload(reason))
            }
        }
        return abi.decode(reason, (uint256, uint256, uint160, int24, uint16));
    }

    function handleRevert(
        bytes memory reason,
        IAlgebraPool pool,
        uint256 gasEstimate
    )
        private
        view
        returns (
            uint256 amountOut,
            uint256 amountIn,
            uint160 sqrtPriceX96After,
            uint32 initializedTicksCrossed,
            uint256,
            uint16 fee
        )
    {
        int24 tickBefore;
        int24 tickAfter;
        (, tickBefore, , , , ) = pool.globalState();
        (amountOut, amountIn, sqrtPriceX96After, tickAfter, fee) = parseRevertReason(reason);

        initializedTicksCrossed = pool.countInitializedTicksCrossed(tickBefore, tickAfter);

        return (amountOut, amountIn, sqrtPriceX96After, initializedTicksCrossed, gasEstimate, fee);
    }

    function quoteExactInputSingle(
        QuoteExactInputSingleParams memory params
    )
        public
        override
        returns (
            uint256 amountOut,
            uint256 amountIn,
            uint160 sqrtPriceX96After,
            uint32 initializedTicksCrossed,
            uint256 gasEstimate,
            uint16 fee
        )
    {
        bool zeroToOne = params.tokenIn < params.tokenOut;
        IAlgebraPool pool = getPool(params.tokenIn, params.tokenOut);

        uint256 gasBefore = gasleft();
        bytes memory data = abi.encodePacked(params.tokenIn, params.tokenOut);
        try
            pool.swap(
                address(this), // address(0) might cause issues with some tokens
                zeroToOne,
                params.amountIn.toInt256(),
                params.limitSqrtPrice == 0
                    ? (zeroToOne ? TickMath.MIN_SQRT_RATIO + 1 : TickMath.MAX_SQRT_RATIO - 1)
                    : params.limitSqrtPrice,
                data
            )
        {} catch (bytes memory reason) {
            gasEstimate = gasBefore - gasleft();
            return handleRevert(reason, pool, gasEstimate);
        }
    }

    function quoteExactInput(
        bytes memory path,
        uint256 amountInRequired
    )
        public
        override
        returns (
            uint256 amountOut,
            uint256 amountIn,
            uint160[] memory sqrtPriceX96AfterList,
            uint32[] memory initializedTicksCrossedList,
            uint256 gasEstimate,
            uint16[] memory feeList
        )
    {
        sqrtPriceX96AfterList = new uint160[](path.numPools());
        initializedTicksCrossedList = new uint32[](path.numPools());
        feeList = new uint16[](path.numPools());

        uint256 i = 0;
        while (true) {
            QuoteExactInputSingleParams memory params;
            {
                (address tokenIn, address tokenOut) = path.decodeFirstPool();

                params.tokenIn = tokenIn;
                params.tokenOut = tokenOut;
                params.amountIn = amountInRequired;
            }

            // the outputs of prior swaps become the inputs to subsequent ones
            uint256 _amountOut;
            uint256 _amountIn;
            uint256 _gasEstimate;
            (
                _amountOut,
                _amountIn,
                sqrtPriceX96AfterList[i],
                initializedTicksCrossedList[i],
                _gasEstimate,
                feeList[i]
            ) = quoteExactInputSingle(params);

            if (i == 0) amountIn = _amountIn;

            amountInRequired = _amountOut;
            gasEstimate += _gasEstimate;
            i++;

            // decide whether to continue or terminate
            if (path.hasMultiplePools()) {
                path = path.skipToken();
            } else {
                return (
                    amountInRequired,
                    amountIn,
                    sqrtPriceX96AfterList,
                    initializedTicksCrossedList,
                    gasEstimate,
                    feeList
                );
            }
        }
    }

    function quoteExactOutputSingle(
        QuoteExactOutputSingleParams memory params
    )
        public
        override
        returns (
            uint256 amountOut,
            uint256 amountIn,
            uint160 sqrtPriceX96After,
            uint32 initializedTicksCrossed,
            uint256 gasEstimate,
            uint16 fee
        )
    {
        bool zeroToOne = params.tokenIn < params.tokenOut;
        IAlgebraPool pool = getPool(params.tokenIn, params.tokenOut);

        // if no price limit has been specified, cache the output amount for comparison in the swap callback
        if (params.limitSqrtPrice == 0) amountOutCached = params.amount;
        uint256 gasBefore = gasleft();
        bytes memory data = abi.encodePacked(params.tokenOut, params.tokenIn);
        try
            pool.swap(
                address(this), // address(0) might cause issues with some tokens
                zeroToOne,
                -params.amount.toInt256(),
                params.limitSqrtPrice == 0
                    ? (zeroToOne ? TickMath.MIN_SQRT_RATIO + 1 : TickMath.MAX_SQRT_RATIO - 1)
                    : params.limitSqrtPrice,
                data
            )
        {} catch (bytes memory reason) {
            gasEstimate = gasBefore - gasleft();
            if (params.limitSqrtPrice == 0) delete amountOutCached; // clear cache
            return handleRevert(reason, pool, gasEstimate);
        }
    }

    function quoteExactOutput(
        bytes memory path,
        uint256 amountOutRequired
    )
        public
        override
        returns (
            uint256 amountOut,
            uint256 amountIn,
            uint160[] memory sqrtPriceX96AfterList,
            uint32[] memory initializedTicksCrossedList,
            uint256 gasEstimate,
            uint16[] memory feeList
        )
    {
        sqrtPriceX96AfterList = new uint160[](path.numPools());
        initializedTicksCrossedList = new uint32[](path.numPools());
        feeList = new uint16[](path.numPools());

        uint256 i = 0;
        while (true) {
            QuoteExactOutputSingleParams memory params;
            {
                (address tokenOut, address tokenIn) = path.decodeFirstPool();

                params.tokenIn = tokenIn;
                params.tokenOut = tokenOut;
                params.amount = amountOutRequired;
            }

            // the inputs of prior swaps become the outputs of subsequent ones
            uint256 _amountOut;
            uint256 _amountIn;
            uint256 _gasEstimate;
            (
                _amountOut,
                _amountIn,
                sqrtPriceX96AfterList[i],
                initializedTicksCrossedList[i],
                _gasEstimate,
                feeList[i]
            ) = quoteExactOutputSingle(params);

            if (i == 0) amountOut = _amountOut;

            amountOutRequired = _amountIn;
            gasEstimate += _gasEstimate;
            i++;

            // decide whether to continue or terminate
            if (path.hasMultiplePools()) {
                path = path.skipToken();
            } else {
                return (
                    amountOut,
                    amountOutRequired,
                    sqrtPriceX96AfterList,
                    initializedTicksCrossedList,
                    gasEstimate,
                    feeList
                );
            }
        }
    }
}
