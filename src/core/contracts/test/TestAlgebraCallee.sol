// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;
pragma abicoder v1;

import '../interfaces/IERC20Minimal.sol';

import '../libraries/SafeCast.sol';
import '../libraries/TickMath.sol';

import '../interfaces/callback/IAlgebraMintCallback.sol';
import '../interfaces/callback/IAlgebraSwapCallback.sol';
import '../interfaces/callback/IAlgebraFlashCallback.sol';

import '../interfaces/IAlgebraPool.sol';

import './LiquidityAmounts.sol';

contract TestAlgebraCallee is IAlgebraMintCallback, IAlgebraSwapCallback, IAlgebraFlashCallback {
  using SafeCast for uint256;

  function getPriceAtTick(int24 tick) external pure returns (uint160 sqrtPrice) {
    return TickMath.getSqrtRatioAtTick(tick);
  }

  function swapExact0For1(address pool, uint256 amount0In, address recipient, uint160 limitSqrtPrice) external {
    IAlgebraPool(pool).swap(recipient, true, int256(amount0In), limitSqrtPrice, abi.encode(msg.sender));
  }

  function swapExact0For1SupportingFee(address pool, uint256 amount0In, address recipient, uint160 limitSqrtPrice) external {
    IAlgebraPool(pool).swapWithPaymentInAdvance(msg.sender, recipient, true, int256(amount0In), limitSqrtPrice, abi.encode(msg.sender));
  }

  function swap0ForExact1(address pool, uint256 amount1Out, address recipient, uint160 limitSqrtPrice) external {
    unchecked {
      IAlgebraPool(pool).swap(recipient, true, -amount1Out.toInt256(), limitSqrtPrice, abi.encode(msg.sender));
    }
  }

  function swapExact1For0(address pool, uint256 amount1In, address recipient, uint160 limitSqrtPrice) external {
    IAlgebraPool(pool).swap(recipient, false, int256(amount1In), limitSqrtPrice, abi.encode(msg.sender));
  }

  function swapExact1For0SupportingFee(address pool, uint256 amount1In, address recipient, uint160 limitSqrtPrice) external {
    IAlgebraPool(pool).swapWithPaymentInAdvance(msg.sender, recipient, false, int256(amount1In), limitSqrtPrice, abi.encode(msg.sender));
  }

  function swap1ForExact0(address pool, uint256 amount0Out, address recipient, uint160 limitSqrtPrice) external {
    unchecked {
      IAlgebraPool(pool).swap(recipient, false, -amount0Out.toInt256(), limitSqrtPrice, abi.encode(msg.sender));
    }
  }

  function swapToLowerSqrtPrice(address pool, uint160 price, address recipient) external {
    IAlgebraPool(pool).swap(recipient, true, type(int256).max, price, abi.encode(msg.sender));
  }

  function swapToHigherSqrtPrice(address pool, uint160 price, address recipient) external {
    IAlgebraPool(pool).swap(recipient, false, type(int256).max, price, abi.encode(msg.sender));
  }

  event SwapCallback(int256 amount0Delta, int256 amount1Delta);

  function algebraSwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external override {
    unchecked {
      address sender = abi.decode(data, (address));

      emit SwapCallback(amount0Delta, amount1Delta);

      if (amount0Delta > 0) {
        IERC20Minimal(IAlgebraPool(msg.sender).token0()).transferFrom(sender, msg.sender, uint256(amount0Delta));
      } else if (amount1Delta > 0) {
        IERC20Minimal(IAlgebraPool(msg.sender).token1()).transferFrom(sender, msg.sender, uint256(amount1Delta));
      } else {
        // if both are not gt 0, both must be 0.
        assert(amount0Delta == 0 && amount1Delta == 0);
      }
    }
  }

  event MintResult(uint256 amount0Owed, uint256 amount1Owed, uint256 resultLiquidity);

  function mint(
    address pool,
    address recipient,
    int24 bottomTick,
    int24 topTick,
    uint128 amount
  ) external returns (uint256 amount0Owed, uint256 amount1Owed, uint256 resultLiquidity) {
    (amount0Owed, amount1Owed, resultLiquidity) = IAlgebraPool(pool).mint(msg.sender, recipient, bottomTick, topTick, amount, abi.encode(msg.sender));
    emit MintResult(amount0Owed, amount1Owed, resultLiquidity);
  }

  event MintCallback(uint256 amount0Owed, uint256 amount1Owed);

  function algebraMintCallback(uint256 amount0Owed, uint256 amount1Owed, bytes calldata data) external override {
    address sender = abi.decode(data, (address));

    if (amount0Owed > 0) IERC20Minimal(IAlgebraPool(msg.sender).token0()).transferFrom(sender, msg.sender, amount0Owed);
    if (amount1Owed > 0) IERC20Minimal(IAlgebraPool(msg.sender).token1()).transferFrom(sender, msg.sender, amount1Owed);

    emit MintCallback(amount0Owed, amount1Owed);
  }

  event FlashCallback(uint256 fee0, uint256 fee1);

  function flash(address pool, address recipient, uint256 amount0, uint256 amount1, uint256 pay0, uint256 pay1) external {
    IAlgebraPool(pool).flash(recipient, amount0, amount1, abi.encode(msg.sender, pay0, pay1));
  }

  function algebraFlashCallback(uint256 fee0, uint256 fee1, bytes calldata data) external override {
    emit FlashCallback(fee0, fee1);

    (address sender, uint256 pay0, uint256 pay1) = abi.decode(data, (address, uint256, uint256));

    if (pay0 > 0) IERC20Minimal(IAlgebraPool(msg.sender).token0()).transferFrom(sender, msg.sender, pay0);
    if (pay1 > 0) IERC20Minimal(IAlgebraPool(msg.sender).token1()).transferFrom(sender, msg.sender, pay1);
  }

  function getPositionKey(address owner, int24 bottomTick, int24 topTick) private pure returns (bytes32 key) {
    assembly {
      key := or(shl(24, or(shl(24, owner), and(bottomTick, 0xFFFFFF))), and(topTick, 0xFFFFFF))
    }
  }
}
