// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.4;

import '@cryptoalgebra/integral-base-plugin/contracts/interfaces/IAlgebraVirtualPool.sol';

/// @title Algebra eternal virtual pool interface
/// @notice Used to track active liquidity in farming and distribute rewards
interface IAlgebraEternalVirtualPool is IAlgebraVirtualPool {
  error onlyPlugin();
  error onlyFarming();

  /// @notice Returns address of the AlgebraEternalFarming
  function farmingAddress() external view returns (address);

  /// @notice Returns address of the plugin for which this virtual pool was created
  function plugin() external view returns (address);

  /// @notice Returns data associated with a tick
  function ticks(
    int24 tickId
  )
    external
    view
    returns (
      uint256 liquidityTotal,
      int128 liquidityDelta,
      int24 prevTick,
      int24 nextTick,
      uint256 outerFeeGrowth0Token,
      uint256 outerFeeGrowth1Token
    );

  /// @notice Returns the current liquidity in virtual pool
  function currentLiquidity() external view returns (uint128);

  /// @notice Returns the current tick in virtual pool
  function globalTick() external view returns (int24);

  /// @notice Returns the timestamp after previous virtual pool update
  function prevTimestamp() external view returns (uint32);

  /// @notice Returns true if virtual pool is deactivated
  function deactivated() external view returns (bool);

  /// @dev This function is called when anyone changes their farmed liquidity. The position in a virtual pool should be changed accordingly.
  /// If the virtual pool is deactivated, does nothing.
  /// @param bottomTick The bottom tick of a position
  /// @param topTick The top tick of a position
  /// @param liquidityDelta The amount of liquidity in a position
  /// @param currentTick The current tick in the main pool
  function applyLiquidityDeltaToPosition(int24 bottomTick, int24 topTick, int128 liquidityDelta, int24 currentTick) external;

  /// @dev This function is called by farming to increase rewards per liquidity accumulator.
  /// Can only be called by farming
  function distributeRewards() external;

  /// @notice Change reward rates
  /// @param rate0 The new rate of main token distribution per sec
  /// @param rate1 The new rate of bonus token distribution per sec
  function setRates(uint128 rate0, uint128 rate1) external;

  /// @notice This function is used to deactivate virtual pool
  /// @dev Can only be called by farming
  function deactivate() external;

  /// @notice Top up rewards reserves
  /// @param token0Amount The amount of token0
  /// @param token1Amount The amount of token1
  function addRewards(uint128 token0Amount, uint128 token1Amount) external;

  /// @notice Withdraw rewards from reserves directly
  /// @param token0Amount The amount of token0
  /// @param token1Amount The amount of token1
  function decreaseRewards(uint128 token0Amount, uint128 token1Amount) external;

  /// @notice Retrieves rewards growth data inside specified range
  /// @dev Should only be used for relative comparison of the same range over time
  /// @param bottomTick The lower tick boundary of the range
  /// @param topTick The upper tick boundary of the range
  /// @return rewardGrowthInside0 The all-time reward growth in token0, per unit of liquidity, inside the range's tick boundaries
  /// @return rewardGrowthInside1 The all-time reward growth in token1, per unit of liquidity, inside the range's tick boundaries
  function getInnerRewardsGrowth(int24 bottomTick, int24 topTick) external view returns (uint256 rewardGrowthInside0, uint256 rewardGrowthInside1);

  /// @notice Get reserves of rewards in one call
  /// @return reserve0 The reserve of token0
  /// @return reserve1 The reserve of token1
  function rewardReserves() external view returns (uint128 reserve0, uint128 reserve1);

  /// @notice Get rates of rewards in one call
  /// @return rate0 The rate of token0, rewards / sec
  /// @return rate1 The rate of token1, rewards / sec
  function rewardRates() external view returns (uint128 rate0, uint128 rate1);

  /// @notice Get reward growth accumulators
  /// @return rewardGrowth0 The reward growth for reward0, per unit of liquidity, has only relative meaning
  /// @return rewardGrowth1 The reward growth for reward1, per unit of liquidity, has only relative meaning
  function totalRewardGrowth() external view returns (uint256 rewardGrowth0, uint256 rewardGrowth1);
}
