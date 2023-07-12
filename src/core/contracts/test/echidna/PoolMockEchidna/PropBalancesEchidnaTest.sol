// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import './PoolMockEchidna.sol';

contract PropBalancesEchidnaTest is PoolMockEchidna {
  function echidna_check_balances_not_zero() public view returns (bool) {
    if (tickTreeRoot > 0) {
      return balance0 > 0 || balance1 > 0;
    } else {
      return true;
    }
  }
}
