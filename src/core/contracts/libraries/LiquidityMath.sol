// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title Math library for liquidity
/// @dev Credit to Uniswap Labs under GPL-2.0-or-later license:
/// https://github.com/Uniswap/v3-core/blob/main/contracts/libraries
library LiquidityMath {
  error LS();
  error LA();

  /// @notice Add a signed liquidity delta to liquidity and revert if it overflows or underflows
  /// @param x The liquidity before change
  /// @param y The delta by which liquidity should be changed
  /// @return z The liquidity delta
  function addDelta(uint128 x, int128 y) internal pure returns (uint128 z) {
    unchecked {
      if (y < 0) {
        if ((z = x - uint128(-y)) >= x) revert LS();
      } else {
        if ((z = x + uint128(y)) < x) revert LA();
      }
    }
  }
}
