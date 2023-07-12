// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import './PoolMockEchidna.sol';

contract PropReservesEchidnaTest is PoolMockEchidna {
  function echidna_check_balance0_reserve0() public view returns (bool) {
    return (balance0 >= reserve0);
  }

  function echidna_check_balance1_reserve1() public view returns (bool) {
    return (balance1 >= reserve1);
  }
}
