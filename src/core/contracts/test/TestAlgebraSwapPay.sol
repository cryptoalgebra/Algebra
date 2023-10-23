// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;
pragma abicoder v1;

import '../interfaces/IERC20Minimal.sol';

import '../interfaces/callback/IAlgebraSwapCallback.sol';
import '../interfaces/callback/IAlgebraMintCallback.sol';
import '../interfaces/IAlgebraPool.sol';

contract TestAlgebraSwapPay is IAlgebraSwapCallback, IAlgebraMintCallback {
  function swap(address pool, address recipient, bool zeroToOne, uint160 price, int256 amountSpecified, uint256 pay0, uint256 pay1) external {
    IAlgebraPool(pool).swap(recipient, zeroToOne, amountSpecified, price, abi.encode(msg.sender, pay0, pay1));
  }

  function swapSupportingFee(
    address pool,
    address recipient,
    bool zeroToOne,
    uint160 price,
    int256 amountSpecified,
    uint256 pay0,
    uint256 pay1
  ) external {
    IAlgebraPool(pool).swapWithPaymentInAdvance(msg.sender, recipient, zeroToOne, amountSpecified, price, abi.encode(msg.sender, pay0, pay1));
  }

  function algebraSwapCallback(int256, int256, bytes calldata data) external override {
    (address sender, uint256 pay0, uint256 pay1) = abi.decode(data, (address, uint256, uint256));

    if (pay0 > 0) {
      IERC20Minimal(IAlgebraPool(msg.sender).token0()).transferFrom(sender, msg.sender, uint256(pay0));
    } else if (pay1 > 0) {
      IERC20Minimal(IAlgebraPool(msg.sender).token1()).transferFrom(sender, msg.sender, uint256(pay1));
    }
  }

  function mint(
    address pool,
    address recipient,
    int24 bottomTick,
    int24 topTick,
    uint128 amount,
    uint256 pay0,
    uint256 pay1
  ) external returns (uint256 amount0Owed, uint256 amount1Owed, uint256 resultLiquidity) {
    (amount0Owed, amount1Owed, resultLiquidity) = IAlgebraPool(pool).mint(
      msg.sender,
      recipient,
      bottomTick,
      topTick,
      amount,
      abi.encode(msg.sender, pay0, pay1)
    );
  }

  function algebraMintCallback(uint256 amount0Owed, uint256 amount1Owed, bytes calldata data) external override {
    (address sender, uint256 pay0, uint256 pay1) = abi.decode(data, (address, uint256, uint256));

    if (amount0Owed > 0) IERC20Minimal(IAlgebraPool(msg.sender).token0()).transferFrom(sender, msg.sender, pay0);
    if (amount1Owed > 0) IERC20Minimal(IAlgebraPool(msg.sender).token1()).transferFrom(sender, msg.sender, pay1);
  }
}
