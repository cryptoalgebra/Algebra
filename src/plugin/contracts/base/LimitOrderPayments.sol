// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '@cryptoalgebra/integral-periphery/contracts/interfaces/external/IWNativeToken.sol';
import '@cryptoalgebra/integral-periphery/contracts/libraries/PoolAddress.sol';

import '../libraries/TransferHelper.sol';

abstract contract LimitOrderPayments {
  constructor(address _wnative) {
    wNativeToken = _wnative;
  }

  address public immutable wNativeToken;

  function _balanceOfToken(address token) private view returns (uint256) {
    return (IERC20(token).balanceOf(address(this)));
  }

  function _pay(address token, address payer, address recipient, uint256 value) internal {
    if (token == wNativeToken && address(this).balance >= value) {
      // pay with WNativeToken
      IWNativeToken(wNativeToken).deposit{value: value}(); // wrap only what is needed to pay
      IWNativeToken(wNativeToken).transfer(recipient, value);
    } else {
      // pull payment
      TransferHelper.safeTransferFrom(token, payer, recipient, value);
    }
  }

  function claimTo(PoolAddress.PoolKey memory poolkey, address to) internal {
    uint256 balanceToken0 = _balanceOfToken(poolkey.token0);
    uint256 balanceToken1 = _balanceOfToken(poolkey.token1);

    if (balanceToken0 > 0) {
      if (poolkey.token0 == wNativeToken) {
        IWNativeToken(wNativeToken).withdraw(balanceToken0);
        TransferHelper.safeTransferNative(to, balanceToken0);
      } else {
        TransferHelper.safeTransfer(poolkey.token0, to, balanceToken0);
      }
    }

    if (balanceToken1 > 0) {
      if (poolkey.token1 == wNativeToken) {
        IWNativeToken(wNativeToken).withdraw(balanceToken1);
        TransferHelper.safeTransferNative(to, balanceToken1);
      } else {
        TransferHelper.safeTransfer(poolkey.token1, to, balanceToken1);
      }
    }
  }
}
