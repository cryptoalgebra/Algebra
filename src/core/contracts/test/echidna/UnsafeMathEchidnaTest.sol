// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../../libraries/FullMath.sol';

contract UnsafeMathEchidnaTest {
  function checkDivRoundingUp(uint256 x, uint256 d) external pure {
    unchecked {
      require(d > 0);
      uint256 z = FullMath.unsafeDivRoundingUp(x, d);
      uint256 diff = z - (x / d);
      if (x % d == 0) {
        assert(diff == 0);
      } else {
        assert(diff == 1);
      }
    }
  }
}
