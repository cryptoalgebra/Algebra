// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.17;
pragma abicoder v2;

import '../libraries/TickManagement.sol';

contract TickTest {
  using TickManagement for mapping(int24 => TickManagement.Tick);

  mapping(int24 => TickManagement.Tick) public ticks;

  function setTick(int24 tick, TickManagement.Tick memory data) external {
    ticks[tick] = data;
  }

  function getInnerFeeGrowth(
    int24 bottomTick,
    int24 topTick,
    int24 currentTick,
    uint256 totalFeeGrowth0Token,
    uint256 totalFeeGrowth1Token
  ) external view returns (uint256 innerFeeGrowth0Token, uint256 innerFeeGrowth1Token) {
    return ticks.getInnerFeeGrowth(bottomTick, topTick, currentTick, totalFeeGrowth0Token, totalFeeGrowth1Token);
  }

  function update(
    int24 tick,
    int24 currentTick,
    int128 liquidityDelta,
    uint256 totalFeeGrowth0Token,
    uint256 totalFeeGrowth1Token,
    uint160 secondsPerLiquidityCumulative,
    uint32 time,
    bool upper
  ) external returns (bool flipped) {
    return ticks.update(tick, currentTick, liquidityDelta, totalFeeGrowth0Token, totalFeeGrowth1Token, secondsPerLiquidityCumulative, time, upper);
  }

  function clear(int24 tick) external {
    delete ticks[tick];
  }

  function cross(
    int24 tick,
    uint256 totalFeeGrowth0Token,
    uint256 totalFeeGrowth1Token,
    uint160 secondsPerLiquidityCumulative,
    uint32 timestamp
  ) external returns (int128 liquidityDelta) {
    return ticks.cross(tick, totalFeeGrowth0Token, totalFeeGrowth1Token, secondsPerLiquidityCumulative, timestamp);
  }
}
