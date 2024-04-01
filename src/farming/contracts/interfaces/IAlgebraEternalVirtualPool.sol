// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.4;

import '@cryptoalgebra/integral-base-plugin/contracts/interfaces/IAlgebraVirtualPool.sol';

/// @title Algebra eternal virtual pool interface
/// @notice Used to track active liquidity in farming and distribute rewards
interface IAlgebraEternalVirtualPool is IAlgebraVirtualPool {
  error onlyPlugin();
  error onlyFarming();

  error alreadyInList();
  error nonZeroRate();
  error indexOutOfRange();

  struct RewardInfo {
    uint128 rewardRate;
    uint128 reserve;
    uint256 totalRewardGrowth;
  }

  /// @notice Returns address of the AlgebraEternalFarming
  function farmingAddress() external view returns (address);

  /// @notice Returns address of the plugin for which this virtual pool was created
  function plugin() external view returns (address);

  /// @notice Returns data associated with a tick
  function ticks(int24 tickId) external view returns (uint256 liquidityTotal, int128 liquidityDelta, int24 prevTick, int24 nextTick);

  function rewardsInfo(address token) external view returns (uint128 rewardRate, uint128 reserve, uint256 totalRewardGrowth);
  /// @notice Returns the current liquidity in virtual pool
  function currentLiquidity() external view returns (uint128);

  /// @notice Returns the current tick in virtual pool
  function globalTick() external view returns (int24);

  function getTickGrowth(int24 tick, address rewardToken) external view returns (uint256 outerFeeGrowth);

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
  /// @param token address
  /// @param rate The new rate of bonus token distribution per sec
  function setRates(address token, uint128 rate) external;

  function setWeights(uint16 weight0, uint16 weight1) external;

  /// @notice This function is used to deactivate virtual pool
  /// @dev Can only be called by farming
  function deactivate() external;

  /// @notice Top up rewards reserves
  /// @param rewardToken reward token
  /// @param amount The amount of token
  function addRewards(address rewardToken, uint128 amount) external;

  /// @notice Withdraw rewards from reserves directly
  /// @param rewardToken reward token
  /// @param amount The amount of token
  function decreaseRewards(address rewardToken, uint128 amount) external;

  function addRewardToken(address newRewardToken) external;

  function removeRewardToken(uint256 tokenIndex) external;

  /// @notice Retrieves rewards growth data inside specified range
  /// @dev Should only be used for relative comparison of the same range over time
  /// @param bottomTick The lower tick boundary of the range
  /// @param topTick The upper tick boundary of the range
  /// @param rewardToken token
  /// @return rewardGrowthInside The all-time reward growth in token0, per unit of liquidity, inside the range's tick boundaries
  function getInnerRewardsGrowth(int24 bottomTick, int24 topTick, address rewardToken) external view returns (uint256 rewardGrowthInside);

  /// @notice Get reserves of rewards in one call
  /// @param rewardToken The reserve of token0
  /// @return reserve The reserve of token1
  function rewardReserve(address rewardToken) external view returns (uint128 reserve);

  /// @notice Get rates of rewards in one call
  /// @param rewardToken token
  /// @return rate The rate of token1, rewards / sec
  function rewardRate(address rewardToken) external view returns (uint128 rate);

  /// @notice Get reward growth accumulators
  /// @param rewardToken token
  /// @return rewardGrowth The reward growth for reward0, per unit of liquidity, has only relative meaning
  function totalRewardGrowth(address rewardToken) external view returns (uint256 rewardGrowth);
}
