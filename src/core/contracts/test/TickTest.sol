// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;
pragma abicoder v2;

import '../libraries/TickManager.sol';

contract TickTest {
  using TickManager for mapping(int24 => TickManager.Tick);

  mapping(int24 => TickManager.Tick) public ticks;

  function setTick(int24 tick, TickManager.Tick memory data) external {
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
    int56 tickCumulative,
    uint32 time,
    bool upper
  ) external returns (bool flipped) {
    return
      ticks.update(
        tick,
        currentTick,
        liquidityDelta,
        totalFeeGrowth0Token,
        totalFeeGrowth1Token,
        secondsPerLiquidityCumulative,
        tickCumulative,
        time,
        upper
      );
  }

  function clear(int24 tick) external {
    delete ticks[tick];
  }

  function cross(
    int24 tick,
    uint256 totalFeeGrowth0Token,
    uint256 totalFeeGrowth1Token,
    uint160 secondsPerLiquidityCumulative,
    int56 tickCumulative,
    uint32 time
  ) external returns (int128 liquidityDelta) {
    return ticks.cross(tick, totalFeeGrowth0Token, totalFeeGrowth1Token, secondsPerLiquidityCumulative, tickCumulative, time);
  }
}
