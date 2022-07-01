// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.5.0 || ^0.6.0 || ^0.7.0 || ^0.8.0;

library Sqrt {
  /// @notice Gets the square root of the absolute value of the parameter
  function sqrtAbs(int256 _x) internal pure returns (uint256 result) {
    // get abs value
    int256 mask = _x >> (256 - 1);
    uint256 x = uint256((_x ^ mask) - mask);
    if (x == 0) result = 0;
    else {
      uint256 xx = x;
      uint256 r = 1;
      if (xx >= 0x100000000000000000000000000000000) {
        xx >>= 128;
        r <<= 64;
      }
      if (xx >= 0x10000000000000000) {
        xx >>= 64;
        r <<= 32;
      }
      if (xx >= 0x100000000) {
        xx >>= 32;
        r <<= 16;
      }
      if (xx >= 0x10000) {
        xx >>= 16;
        r <<= 8;
      }
      if (xx >= 0x100) {
        xx >>= 8;
        r <<= 4;
      }
      if (xx >= 0x10) {
        xx >>= 4;
        r <<= 2;
      }
      if (xx >= 0x8) {
        r <<= 1;
      }
      r = (r + x / r) >> 1;
      r = (r + x / r) >> 1;
      r = (r + x / r) >> 1;
      r = (r + x / r) >> 1;
      r = (r + x / r) >> 1;
      r = (r + x / r) >> 1;
      r = (r + x / r) >> 1; // @dev Seven iterations should be enough.
      uint256 r1 = x / r;
      result = r < r1 ? r : r1;
    }
  }
}
