// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../libraries/TickTable.sol';

contract BitMathEchidnaTest {
  function mostSignificantBitInvariant(uint256 input) external pure {
    require(input > 0);
    uint8 msb = TickTable.getMostSignificantBit(input);
    assert(input >= (uint256(2)**msb));
    assert(msb == 255 || input < uint256(2)**(msb + 1));
  }

  function leastSignificantBitInvariant(uint256 input) external pure {
    require(input > 0);
    uint8 lsb = TickTable.getSingleSignificantBit(-input & input);
    assert(input & (uint256(2)**lsb) != 0);
    assert(input & (uint256(2)**lsb - 1) == 0);
  }
}
