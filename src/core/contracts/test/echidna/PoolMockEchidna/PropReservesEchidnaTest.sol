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

  /// @dev The pending community fee is a part of the reserves, which keeps its uint128 casts safe
  function echidna_check_pending_fees_within_reserves() public view returns (bool) {
    return communityFeePending0 <= reserve0 && communityFeePending1 <= reserve1;
  }
}
