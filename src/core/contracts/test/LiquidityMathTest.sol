// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;
pragma abicoder v1;

import '../libraries/LiquidityMath.sol';

contract LiquidityMathTest {
  function addDelta(uint128 x, int128 y) external pure returns (uint128 z) {
    return LiquidityMath.addDelta(x, y);
  }

  function getGasCostOfAddDelta(uint128 x, int128 y) external view returns (uint256) {
    unchecked {
      uint256 gasBefore = gasleft();
      LiquidityMath.addDelta(x, y);
      return gasBefore - gasleft();
    }
  }
}
