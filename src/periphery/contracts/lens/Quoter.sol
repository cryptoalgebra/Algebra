// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '@cryptoalgebra/core/contracts/libraries/SafeCast.sol';
import '@cryptoalgebra/core/contracts/libraries/TickMath.sol';

import '@cryptoalgebra/core/contracts/libraries/FullMath.sol';
import '@cryptoalgebra/core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/core/contracts/interfaces/callback/IAlgebraSwapCallback.sol';

import '../interfaces/IQuoter.sol';
import '../base/PeripheryImmutableState.sol';
import '../libraries/Path.sol';
import '../libraries/PoolAddress.sol';
import '../libraries/CallbackValidation.sol';

import 'hardhat/console.sol';

/// @title Provides quotes for swaps
/// @notice Allows getting the expected amount out or amount in for a given swap without executing the swap
/// @dev These functions are not gas efficient and should _not_ be called on chain. Instead, optimistically execute
/// the swap and check the amounts in the callback.
/// Credit to Uniswap Labs under GPL-2.0-or-later license:
/// https://github.com/Uniswap/v3-periphery
contract Quoter is IQuoter, IAlgebraSwapCallback, PeripheryImmutableState {
    using Path for bytes;
    using SafeCast for uint256;

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
    function algebraSwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        uint256 feeAmount,
        bytes memory path
    ) external view override {
        require(amount0Delta > 0 || amount1Delta > 0); // swaps entirely within 0-liquidity regions are not supported
        (address tokenIn, address tokenOut) = path.decodeFirstPool();
        CallbackValidation.verifyCallback(poolDeployer, tokenIn, tokenOut);

        (bool isExactInput, uint256 amountToPay, uint256 amountReceived) = amount0Delta > 0
            ? (tokenIn < tokenOut, uint256(amount0Delta), uint256(-amount1Delta))
            : (tokenOut < tokenIn, uint256(amount1Delta), uint256(-amount0Delta));

        IAlgebraPool pool = getPool(tokenIn, tokenOut);
        (, , uint16 fee, , , , ) = pool.globalState();
        console.log('amounts');
        console.log(feeAmount);
        console.log(amountToPay);
        uint256 expectedFee = FullMath.mulDivRoundingUp(fee, amountToPay, 1e6);
        if (feeAmount != 0 && (expectedFee != feeAmount)) {
            uint256 actualFee = FullMath.mulDiv(feeAmount, 1e6, amountToPay);
            if (actualFee < 50000) {
                fee = uint16(actualFee);
            } else {
                fee = 50000;
            }
        }

        if (isExactInput) {
            assembly {
                let ptr := mload(0x40)
                mstore(ptr, amountReceived)
                mstore(add(ptr, 0x20), fee)
                revert(ptr, 64)
            }
        } else {
            // if the cache has been populated, ensure that the full output amount has been received
            if (amountOutCached != 0) require(amountReceived == amountOutCached);
            assembly {
                let ptr := mload(0x40)
                mstore(ptr, amountToPay)
                mstore(add(ptr, 0x20), fee)
                revert(ptr, 64)
            }
        }
    }

    /// @dev Parses a revert reason that should contain the numeric quote
    function parseRevertReason(bytes memory reason) private view returns (uint256, uint16) {
        console.log('reason length');
        console.log(reason.length);
        if (reason.length != 64) {
            if (reason.length < 68) revert('Unexpected error');
            assembly {
                reason := add(reason, 0x04)
            }
            revert(abi.decode(reason, (string)));
        }
        return abi.decode(reason, (uint256, uint16));
    }

    /// @inheritdoc IQuoter
    function quoteExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint160 limitSqrtPrice
    ) public override returns (uint256 amountOut, uint16 fee) {
        bool zeroToOne = tokenIn < tokenOut;

        try
            getPool(tokenIn, tokenOut).swap(
                address(this), // address(0) might cause issues with some tokens
                zeroToOne,
                amountIn.toInt256(),
                limitSqrtPrice == 0
                    ? (zeroToOne ? TickMath.MIN_SQRT_RATIO + 1 : TickMath.MAX_SQRT_RATIO - 1)
                    : limitSqrtPrice,
                abi.encodePacked(tokenIn, tokenOut)
            )
        {} catch (bytes memory reason) {
            (amountOut, fee) = parseRevertReason(reason);
        }
    }

    /// @inheritdoc IQuoter
    function quoteExactInput(bytes memory path, uint256 amountIn)
        external
        override
        returns (uint256 amountOut, uint16[] memory fees)
    {
        fees = new uint16[](path.numPools());
        uint256 i = 0;
        while (true) {
            bool hasMultiplePools = path.hasMultiplePools();

            (address tokenIn, address tokenOut) = path.decodeFirstPool();

            // the outputs of prior swaps become the inputs to subsequent ones
            (amountIn, fees[i]) = quoteExactInputSingle(tokenIn, tokenOut, amountIn, 0);

            // decide whether to continue or terminate
            if (hasMultiplePools) {
                path = path.skipToken();
            } else {
                return (amountIn, fees);
            }
            i++;
        }
    }

    /// @inheritdoc IQuoter
    function quoteExactOutputSingle(
        address tokenIn,
        address tokenOut,
        uint256 amountOut,
        uint160 limitSqrtPrice
    ) public override returns (uint256 amountIn, uint16 fee) {
        bool zeroToOne = tokenIn < tokenOut;

        // if no price limit has been specified, cache the output amount for comparison in the swap callback
        if (limitSqrtPrice == 0) amountOutCached = amountOut;
        try
            getPool(tokenIn, tokenOut).swap(
                address(this), // address(0) might cause issues with some tokens
                zeroToOne,
                -amountOut.toInt256(),
                limitSqrtPrice == 0
                    ? (zeroToOne ? TickMath.MIN_SQRT_RATIO + 1 : TickMath.MAX_SQRT_RATIO - 1)
                    : limitSqrtPrice,
                abi.encodePacked(tokenOut, tokenIn)
            )
        {} catch (bytes memory reason) {
            if (limitSqrtPrice == 0) delete amountOutCached; // clear cache
            (amountIn, fee) = parseRevertReason(reason);
        }
    }

    /// @inheritdoc IQuoter
    function quoteExactOutput(bytes memory path, uint256 amountOut)
        external
        override
        returns (uint256 amountIn, uint16[] memory fees)
    {
        fees = new uint16[](path.numPools());
        uint256 i = 0;
        while (true) {
            bool hasMultiplePools = path.hasMultiplePools();

            (address tokenOut, address tokenIn) = path.decodeFirstPool();

            // the inputs of prior swaps become the outputs of subsequent ones
            (amountOut, fees[i]) = quoteExactOutputSingle(tokenIn, tokenOut, amountOut, 0);

            // decide whether to continue or terminate
            if (hasMultiplePools) {
                path = path.skipToken();
            } else {
                return (amountOut, fees);
            }
            i++;
        }
    }
}
