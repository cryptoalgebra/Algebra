// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../libraries/TickTable.sol';

contract BitMathEchidnaTest {
  function leastSignificantBitInvariant(uint256 input) external pure {
    require(input > 0);
    uint8 lsb = TickTable.getSingleSignificantBit(-input & input);
    assert(input & (uint256(2)**lsb) != 0);
    assert(input & (uint256(2)**lsb - 1) == 0);
  }
}
