// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../../libraries/TickTree.sol';

contract BitMathEchidnaTest {
  function leastSignificantBitInvariant(uint256 input) external pure {
    unchecked {
      require(input > 0);
      uint8 lsb = TickTree.getSingleSignificantBit((0 - input) & input);
      assert(input & (uint256(2) ** lsb) != 0);
      assert(input & (uint256(2) ** lsb - 1) == 0);
    }
  }
}
