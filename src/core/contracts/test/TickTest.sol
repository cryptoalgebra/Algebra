// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;
pragma abicoder v2;

import '../libraries/TickManagement.sol';

contract TickTest {
  using TickManagement for mapping(int24 => TickManagement.Tick);

  mapping(int24 => TickManagement.Tick) public ticks;

  function setTick(int24 tick, TickManagement.Tick memory data) external {
    ticks[tick] = data;
  }

  function maxLiquidityPerTick() external pure returns (uint128) {
    return Constants.MAX_LIQUIDITY_PER_TICK;
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
    bool upper
  ) external returns (bool flipped) {
    return ticks.update(tick, currentTick, liquidityDelta, totalFeeGrowth0Token, totalFeeGrowth1Token, upper);
  }

  function clear(int24 tick) external {
    delete ticks[tick];
  }

  function cross(int24 tick, uint256 totalFeeGrowth0Token, uint256 totalFeeGrowth1Token) external returns (int128 liquidityDelta) {
    (liquidityDelta, , ) = ticks.cross(tick, totalFeeGrowth0Token, totalFeeGrowth1Token);
  }

  function removeTick(int24 tick) external returns (int24, int24) {
    return ticks.removeTick(tick);
  }

  function insertTick(int24 tick, int24 prevTick, int24 nextTick) external {
    return ticks.insertTick(tick, prevTick, nextTick);
  }

  function init() external {
    ticks.initTickState();
  }
}
