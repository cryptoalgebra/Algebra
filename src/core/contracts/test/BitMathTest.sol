// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../libraries/TickTree.sol';

contract BitMathTest {
  function leastSignificantBit(uint256 x) external pure returns (uint8 r) {
    return TickTree.getSingleSignificantBit(-x & x);
  }

  function getGasCostOfLeastSignificantBit(uint256 x) external view returns (uint256) {
    uint256 gasBefore = gasleft();
    TickTree.getSingleSignificantBit(-x & x);
    return gasBefore - gasleft();
  }
}
