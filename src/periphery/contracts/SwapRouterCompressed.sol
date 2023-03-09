// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

import '@cryptoalgebra/core/contracts/libraries/SafeCast.sol';
import '@cryptoalgebra/core/contracts/libraries/TickMath.sol';
import '@cryptoalgebra/core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/core/contracts/interfaces/callback/IAlgebraSwapCallback.sol';

import './libraries/CompressedEncoding.sol';
import './libraries/Path.sol';
import './libraries/PoolAddress.sol';
import './libraries/CallbackValidation.sol';
import './libraries/TransferHelper.sol';
import './interfaces/external/IWNativeToken.sol';

/// @title Algebra Swap Router TODO
/// @notice Router for stateless execution of swaps against Algebra
contract SwapRouterCompressed is IAlgebraSwapCallback {
    using Path for bytes;
    using SafeCast for uint256;

    address private immutable factory;
    address private immutable poolDeployer;
    address private immutable WNativeToken;

    /// @dev Used as the placeholder value for amountInCached, because the computed amount in for an exact output swap
    /// can never actually be this value
    uint256 private constant DEFAULT_AMOUNT_IN_CACHED = type(uint256).max;

    /// @dev Transient storage variable used for returning the computed amount in for an exact output swap.
    uint256 private amountInCached = DEFAULT_AMOUNT_IN_CACHED;

    uint256 private nextTokenIndex = 1;
    mapping(uint256 => address) private indexToToken;
    mapping(address => uint256) private tokenToIndex;

    constructor(address _factory, address _WNativeToken, address _poolDeployer) {
        factory = _factory;
        WNativeToken = _WNativeToken;
        poolDeployer = _poolDeployer;

        indexToToken[0] = _WNativeToken;
    }

    function addTokenAddress(address token) external payable {
        uint256 index = nextTokenIndex;
        nextTokenIndex++;
        indexToToken[index] = token;
        tokenToIndex[token] = index;
    }

    function getTokenByIndex(uint256 index) external view returns (address) {
        return indexToToken[index];
    }

    function getIndexByToken(address token) external view returns (uint256) {
        return tokenToIndex[token];
    }

    function sweep(address token, uint256 amountMinimum) external {
        uint256 balanceToken = IERC20(token).balanceOf(address(this));
        require(balanceToken > amountMinimum && balanceToken > 1, 'Insufficient token');
        balanceToken -= 1; // do not clean storage slot

        if (balanceToken > 0) {
            TransferHelper.safeTransfer(token, msg.sender, balanceToken);
        }
    }

    struct SwapCallbackData {
        bytes path;
        address payer;
    }

    /// @inheritdoc IAlgebraSwapCallback
    function algebraSwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata _data) external override {
        require(amount0Delta > 0 || amount1Delta > 0); // swaps entirely within 0-liquidity regions are not supported
        SwapCallbackData memory data = abi.decode(_data, (SwapCallbackData));
        (address tokenIn, address tokenOut) = data.path.decodeFirstPool();
        CallbackValidation.verifyCallback(poolDeployer, tokenIn, tokenOut);

        (bool isExactInput, uint256 amountToPay) = amount0Delta > 0
            ? (tokenIn < tokenOut, uint256(amount0Delta))
            : (tokenOut < tokenIn, uint256(amount1Delta));
        if (isExactInput) {
            pay(tokenIn, data.payer, msg.sender, amountToPay);
        } else {
            // either initiate the next swap or pay
            if (data.path.hasMultiplePools()) {
                data.path = data.path.skipToken();
                exactOutputInternal(amountToPay, msg.sender, 0, data);
            } else {
                amountInCached = amountToPay;
                tokenIn = tokenOut; // swap in/out because exact output swaps are reversed
                pay(tokenIn, data.payer, msg.sender, amountToPay);
            }
        }
    }

    receive() external payable {
        //
    }

    fallback() external payable {
        uint256 memPointer;
        uint256 callDataLength;
        bytes32 word1;
        assembly {
            callDataLength := calldatasize()
            memPointer := mload(0x40)
            mstore(0x40, add(memPointer, callDataLength))
            calldatacopy(memPointer, 0, callDataLength)
            word1 := calldataload(0)
        }

        SwapConfiguration memory swapConfiguration = decodeCalldata(memPointer, callDataLength, word1);

        if (!swapConfiguration.hasRecipient && !swapConfiguration.unwrapResultWNative)
            swapConfiguration.recipient = msg.sender;

        if (swapConfiguration.exactIn) {
            if (swapConfiguration.path.numPools() > 1) {
                exactInput(swapConfiguration);
            } else {
                exactInputSingle(swapConfiguration);
            }
        } else {
            if (swapConfiguration.path.numPools() > 1) {
                exactOutput(swapConfiguration);
            } else {
                exactOutputSingle(swapConfiguration);
            }
        }

        if (swapConfiguration.unwrapResultWNative) {
            if (!swapConfiguration.hasRecipient) swapConfiguration.recipient = msg.sender;
            unwrapWNativeToken(swapConfiguration.recipient);
        }
    }

    struct SwapConfiguration {
        bool exactIn;
        bool feeOnTransfer;
        bool hasRecipient;
        bool unwrapResultWNative;
        bool hasLimitSqrtPrice;
        uint256 amountIn;
        uint256 amountOutMin;
        address recipient;
        uint160 limitSqrtPrice;
        uint32 deadline;
        bytes path;
    }

    function decodeCalldata(
        uint256 memPointer,
        uint256 callDataLength,
        bytes32 word1
    ) private view returns (SwapConfiguration memory swapConfiguration) {
        bytes1 config;
        uint256 tokenAddressEncoding;
        uint128 pathLength;

        {
            bool exactIn;
            bool feeOnTransfer;
            bool unwrapResultWNative;
            bool hasLimitSqrtPrice;

            assembly {
                config := shr(248, word1)
                pathLength := and(config, 7)
                tokenAddressEncoding := and(shr(246, word1), 0x3)
                exactIn := iszero(and(config, shl(6, 1)))
                feeOnTransfer := iszero(and(config, shl(5, 1)))
                unwrapResultWNative := iszero(and(config, shl(4, 1)))
                hasLimitSqrtPrice := iszero(and(config, shl(3, 1)))
            }
            swapConfiguration.exactIn = !exactIn;
            swapConfiguration.feeOnTransfer = !feeOnTransfer;
            swapConfiguration.unwrapResultWNative = !unwrapResultWNative;
            swapConfiguration.hasLimitSqrtPrice = !hasLimitSqrtPrice;
        }

        uint256 offset = 10;

        (swapConfiguration.path, offset) = CompressedEncoding.parsePath(
            indexToToken,
            word1,
            offset,
            tokenAddressEncoding,
            pathLength
        );

        if (swapConfiguration.exactIn) {
            if (msg.value == 0) {
                (swapConfiguration.amountIn, offset) = CompressedEncoding.parseAmount(memPointer, offset);
            } else {
                (address inputToken, ) = swapConfiguration.path.decodeFirstPool();
                if (inputToken == WNativeToken) {
                    swapConfiguration.amountIn = msg.value;
                } else {
                    (swapConfiguration.amountIn, offset) = CompressedEncoding.parseAmount(memPointer, offset);
                }
            }

            (swapConfiguration.amountOutMin, offset) = CompressedEncoding.parseAmount(memPointer, offset);
        } else {
            (swapConfiguration.amountIn, offset) = CompressedEncoding.parseAmount(memPointer, offset);

            if (msg.value == 0) {
                (swapConfiguration.amountOutMin, offset) = CompressedEncoding.parseAmount(memPointer, offset);
            } else {
                (, address inputToken) = swapConfiguration.path.decodeLastPool();
                if (inputToken == WNativeToken) {
                    swapConfiguration.amountOutMin = msg.value;
                } else {
                    (swapConfiguration.amountOutMin, offset) = CompressedEncoding.parseAmount(memPointer, offset);
                }
            }
        }

        if (swapConfiguration.hasLimitSqrtPrice) {
            (swapConfiguration.limitSqrtPrice, offset) = CompressedEncoding.parse160(memPointer, offset);
        }

        if (callDataLength > offset / 8) {
            if (callDataLength > offset / 8 + 160) {
                uint160 _recipient;
                (_recipient, offset) = CompressedEncoding.parse160(memPointer, offset);
                swapConfiguration.recipient = address(_recipient);
                swapConfiguration.hasRecipient = true;
            }
            if (callDataLength > offset / 8) {
                (swapConfiguration.deadline, ) = CompressedEncoding.parse32(memPointer, offset);
            }
        }
    }

    /// @dev Returns the pool for the given token pair and fee. The pool contract may or may not exist.
    function getPool(address tokenA, address tokenB) private view returns (IAlgebraPool) {
        return IAlgebraPool(PoolAddress.computeAddress(poolDeployer, PoolAddress.getPoolKey(tokenA, tokenB)));
    }

    /// @dev Performs a single exact input swap
    function exactInputInternal(
        uint256 amountIn,
        address recipient,
        uint160 limitSqrtPrice,
        SwapCallbackData memory data
    ) private returns (uint256 amountOut) {
        if (recipient == address(0)) recipient = address(this); // allow swapping to the router address with address 0

        (address tokenIn, address tokenOut) = data.path.decodeFirstPool();
        bool zeroToOne = tokenIn < tokenOut;

        (int256 amount0, int256 amount1) = getPool(tokenIn, tokenOut).swap(
            recipient,
            zeroToOne,
            amountIn.toInt256(),
            limitSqrtPrice == 0
                ? (zeroToOne ? TickMath.MIN_SQRT_RATIO + 1 : TickMath.MAX_SQRT_RATIO - 1)
                : limitSqrtPrice,
            abi.encode(data)
        );

        return uint256(-(zeroToOne ? amount1 : amount0));
    }

    /// @dev Performs a single exact input swap supporting fee on transfer tokens
    function exactInputSupportingFeeInternal(
        uint256 amountIn,
        address recipient,
        uint160 limitSqrtPrice,
        SwapCallbackData memory data
    ) private returns (uint256 amountOut) {
        if (recipient == address(0)) recipient = address(this); // allow swapping to the router address with address 0

        (address tokenIn, address tokenOut) = data.path.decodeFirstPool();
        bool zeroToOne = tokenIn < tokenOut;

        (int256 amount0, int256 amount1) = getPool(tokenIn, tokenOut).swapSupportingFeeOnInputTokens(
            data.payer,
            recipient,
            zeroToOne,
            amountIn.toInt256(),
            limitSqrtPrice == 0
                ? (zeroToOne ? TickMath.MIN_SQRT_RATIO + 1 : TickMath.MAX_SQRT_RATIO - 1)
                : limitSqrtPrice,
            abi.encode(data)
        );

        return uint256(-(zeroToOne ? amount1 : amount0));
    }

    function exactInputSingle(SwapConfiguration memory params) private returns (uint256 amountOut) {
        if (!params.feeOnTransfer) {
            amountOut = exactInputInternal(
                params.amountIn,
                params.recipient,
                params.limitSqrtPrice,
                SwapCallbackData({path: params.path, payer: msg.sender})
            );
        } else {
            amountOut = exactInputSupportingFeeInternal(
                params.amountIn,
                params.recipient,
                params.limitSqrtPrice,
                SwapCallbackData({path: params.path, payer: msg.sender})
            );
        }

        require(amountOut >= params.amountOutMin, 'Too little received');
    }

    function exactInput(SwapConfiguration memory params) private returns (uint256 amountOut) {
        address payer = msg.sender; // msg.sender pays for the first hop

        while (true) {
            bool hasMultiplePools = params.path.hasMultiplePools();

            if (!params.feeOnTransfer) {
                // the outputs of prior swaps become the inputs to subsequent ones
                params.amountIn = exactInputInternal(
                    params.amountIn,
                    hasMultiplePools ? address(this) : params.recipient, // for intermediate swaps, this contract custodies
                    0,
                    SwapCallbackData({
                        path: params.path.getFirstPool(), // only the first pool in the path is necessary
                        payer: payer
                    })
                );
            } else {
                // the outputs of prior swaps become the inputs to subsequent ones
                params.amountIn = exactInputSupportingFeeInternal(
                    params.amountIn,
                    hasMultiplePools ? address(this) : params.recipient, // for intermediate swaps, this contract custodies
                    0,
                    SwapCallbackData({
                        path: params.path.getFirstPool(), // only the first pool in the path is necessary
                        payer: payer
                    })
                );
            }

            // decide whether to continue or terminate
            if (hasMultiplePools) {
                payer = address(this); // at this point, the caller has paid
                params.path = params.path.skipToken();
            } else {
                amountOut = params.amountIn;
                break;
            }
        }

        require(amountOut >= params.amountOutMin, 'Too little received');
    }

    /// @dev Performs a single exact output swap
    function exactOutputInternal(
        uint256 amountOut,
        address recipient,
        uint160 limitSqrtPrice,
        SwapCallbackData memory data
    ) private returns (uint256 amountIn) {
        if (recipient == address(0)) recipient = address(this); // allow swapping to the router address with address 0

        (address tokenOut, address tokenIn) = data.path.decodeFirstPool();

        bool zeroToOne = tokenIn < tokenOut;
        (int256 amount0Delta, int256 amount1Delta) = getPool(tokenIn, tokenOut).swap(
            recipient,
            zeroToOne,
            -amountOut.toInt256(),
            limitSqrtPrice == 0
                ? (zeroToOne ? TickMath.MIN_SQRT_RATIO + 1 : TickMath.MAX_SQRT_RATIO - 1)
                : limitSqrtPrice,
            abi.encode(data)
        );

        uint256 amountOutReceived;
        (amountIn, amountOutReceived) = zeroToOne
            ? (uint256(amount0Delta), uint256(-amount1Delta))
            : (uint256(amount1Delta), uint256(-amount0Delta));
        // it's technically possible to not receive the full output amount,
        // so if no price limit has been specified, require this possibility away
        if (limitSqrtPrice == 0) require(amountOutReceived == amountOut);
    }

    function exactOutputSingle(SwapConfiguration memory params) private returns (uint256 amountIn) {
        // avoid an SLOAD by using the swap return data
        amountIn = exactOutputInternal(
            params.amountIn,
            params.recipient,
            params.limitSqrtPrice,
            SwapCallbackData({path: params.path, payer: msg.sender})
        );

        require(amountIn <= params.amountOutMin, 'Too much requested');
        amountInCached = DEFAULT_AMOUNT_IN_CACHED; // has to be reset even though we don't use it in the single hop case
    }

    function exactOutput(SwapConfiguration memory params) private returns (uint256 amountIn) {
        // it's okay that the payer is fixed to msg.sender here, as they're only paying for the "final" exact output
        // swap, which happens first, and subsequent swaps are paid for within nested callback frames
        exactOutputInternal(
            params.amountIn,
            params.recipient,
            0,
            SwapCallbackData({path: params.path, payer: msg.sender})
        );

        amountIn = amountInCached;
        require(amountIn <= params.amountOutMin, 'Too much requested');
        amountInCached = DEFAULT_AMOUNT_IN_CACHED;
    }

    /// @param token The token to pay
    /// @param payer The entity that must pay
    /// @param recipient The entity that will receive payment
    /// @param value The amount to pay
    function pay(address token, address payer, address recipient, uint256 value) internal {
        if (token == WNativeToken && address(this).balance >= value) {
            // pay with WNativeToken
            IWNativeToken(WNativeToken).deposit{value: value}(); // wrap only what is needed to pay
            IWNativeToken(WNativeToken).transfer(recipient, value);
        } else if (payer == address(this)) {
            // pay with tokens already in the contract (for the exact input multihop case)
            TransferHelper.safeTransfer(token, recipient, value);
        } else {
            // pull payment
            TransferHelper.safeTransferFrom(token, payer, recipient, value);
        }
    }

    function unwrapWNativeToken(address recipient) internal {
        uint256 balanceWNativeToken = IWNativeToken(WNativeToken).balanceOf(address(this));
        require(balanceWNativeToken >= 2, 'Insufficient WNativeToken');
        balanceWNativeToken -= 1;
        if (balanceWNativeToken > 0) {
            IWNativeToken(WNativeToken).withdraw(balanceWNativeToken);
            TransferHelper.safeTransferNative(recipient, balanceWNativeToken);
        }
    }
}
