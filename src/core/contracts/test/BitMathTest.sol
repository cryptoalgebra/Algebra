// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../libraries/TickTree.sol';

contract BitMathTest {
  function leastSignificantBit(uint256 x) external pure returns (uint8 r) {
    unchecked {
      return TickTree.getSingleSignificantBit((0 - x) & x);
    }
  }

  function getGasCostOfLeastSignificantBit(uint256 x) external view returns (uint256) {
    unchecked {
      uint256 gasBefore = gasleft();
      TickTree.getSingleSignificantBit((0 - x) & x);
      return gasBefore - gasleft();
    }
  }
}
