// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../libraries/TickTable.sol';

contract BitMathTest {
  function leastSignificantBit(uint256 x) external pure returns (uint8 r) {
    return TickTable.getSingleSignificantBit(-x & x);
  }

  function getGasCostOfLeastSignificantBit(uint256 x) external view returns (uint256) {
    uint256 gasBefore = gasleft();
    TickTable.getSingleSignificantBit(-x & x);
    return gasBefore - gasleft();
  }
}
