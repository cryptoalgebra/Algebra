// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../interfaces/IERC20Minimal.sol';

import '../interfaces/callback/IAlgebraSwapCallback.sol';
import '../interfaces/IAlgebraPool.sol';

contract AlgebraPoolSwapTest is IAlgebraSwapCallback {
  int256 private _amount0Delta;
  int256 private _amount1Delta;

  function getSwapResult(
    address pool,
    bool zeroToOne,
    int256 amountSpecified,
    uint160 limitSqrtPrice
  ) external returns (int256 amount0Delta, int256 amount1Delta, uint160 nextSqrtRatio) {
    (amount0Delta, amount1Delta) = IAlgebraPool(pool).swap(address(0), zeroToOne, amountSpecified, limitSqrtPrice, abi.encode(msg.sender));

    (nextSqrtRatio, , , , , ) = IAlgebraPool(pool).globalState();
  }

  function algebraSwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external override {
    address sender = abi.decode(data, (address));

    if (amount0Delta > 0) {
      IERC20Minimal(IAlgebraPool(msg.sender).token0()).transferFrom(sender, msg.sender, uint256(amount0Delta));
    } else if (amount1Delta > 0) {
      IERC20Minimal(IAlgebraPool(msg.sender).token1()).transferFrom(sender, msg.sender, uint256(amount1Delta));
    }
  }
}
