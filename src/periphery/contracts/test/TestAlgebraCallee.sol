// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '@cryptoalgebra/core/contracts/interfaces/callback/IAlgebraSwapCallback.sol';
import '@cryptoalgebra/core/contracts/libraries/SafeCast.sol';
import '@cryptoalgebra/core/contracts/interfaces/IAlgebraPool.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract TestAlgebraCallee is IAlgebraSwapCallback {
    using SafeCast for uint256;

    function swapExact0For1(
        address pool,
        uint256 amount0In,
        address recipient,
        uint160 limitSqrtPrice
    ) external {
        IAlgebraPool(pool).swap(recipient, true, amount0In.toInt256(), limitSqrtPrice, abi.encode(msg.sender));
    }

    function swap0ForExact1(
        address pool,
        uint256 amount1Out,
        address recipient,
        uint160 limitSqrtPrice
    ) external {
        IAlgebraPool(pool).swap(recipient, true, -amount1Out.toInt256(), limitSqrtPrice, abi.encode(msg.sender));
    }

    function swapExact1For0(
        address pool,
        uint256 amount1In,
        address recipient,
        uint160 limitSqrtPrice
    ) external {
        IAlgebraPool(pool).swap(recipient, false, amount1In.toInt256(), limitSqrtPrice, abi.encode(msg.sender));
    }

    function swap1ForExact0(
        address pool,
        uint256 amount0Out,
        address recipient,
        uint160 limitSqrtPrice
    ) external {
        IAlgebraPool(pool).swap(recipient, false, -amount0Out.toInt256(), limitSqrtPrice, abi.encode(msg.sender));
    }

    function algebraSwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        uint256,
        bytes calldata data
    ) external override {
        address sender = abi.decode(data, (address));

        if (amount0Delta > 0) {
            IERC20(IAlgebraPool(msg.sender).token0()).transferFrom(sender, msg.sender, uint256(amount0Delta));
        } else {
            assert(amount1Delta > 0);
            IERC20(IAlgebraPool(msg.sender).token1()).transferFrom(sender, msg.sender, uint256(amount1Delta));
        }
    }
}
