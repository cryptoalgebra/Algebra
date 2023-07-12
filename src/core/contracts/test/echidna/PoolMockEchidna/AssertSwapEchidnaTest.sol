// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import './PoolMockEchidna.sol';

contract AssertSwapEchidnaTest is PoolMockEchidna {
  function _swapCallback(int256 amount0, int256 amount1, bytes calldata data) internal override {
    if (amount0 < 0 || amount1 < 0) {
      assert(amount0 > 0 || amount1 > 0);
    }
    if (data.length > 0) {
      MintData memory mintData = abi.decode(data, (MintData));
      balance0 += mintData.pay0;
      balance1 += mintData.pay1;
    } else {
      if (amount0 > 0) {
        balance0 += uint256(amount0);
      } else if (amount1 > 0) {
        balance1 += uint256(amount1);
      }
    }
  }
}
