// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import './../../libraries/VolatilityOracle.sol';

contract VolatilityOracleMathEchidnaTest {
  /// @dev The minimum tick that may be passed to #getSqrtRatioAtTick computed from log base 1.0001 of 2**-128
  int24 internal constant MIN_TICK = -887272;
  /// @dev The maximum tick that may be passed to #getSqrtRatioAtTick computed from log base 1.0001 of 2**128
  int24 internal constant MAX_TICK = -MIN_TICK;

  function checkVolatilityOnRange(uint32 dt, int24 tick0, int24 tick1, int24 avgTick0, int24 avgTick1) external pure {
    uint256 volatility = VolatilityOracle._volatilityOnRange(int256(uint256(dt)), tick0, tick1, avgTick0, avgTick1);
    assert(volatility <= type(uint88).max);
  }

  function checkLteConsideringOverflow(uint64 a, uint64 b, uint64 currentTime) external pure {
    require(a <= currentTime);
    require(b <= currentTime);
    require(currentTime - a <= type(uint32).max);
    require(currentTime - b <= type(uint32).max);

    bool res = VolatilityOracle._lteConsideringOverflow(uint32(a), uint32(b), uint32(currentTime));

    if ((a <= currentTime && b <= currentTime) || (a > currentTime && b > currentTime)) {
      assert(res == a <= b);
    }
  }
}
