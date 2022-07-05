// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

// @title Pool state that can change
interface IAlgebraPoolState {
  /**
   * @notice The globalState structure in the pool stores many values but requires only one slot
   * and is exposed as a single method to save gas when accessed externally.
   * @return price The current price of the pool as a sqrt(token1/token0) Q64.96 value
   * @return tick The current tick of the pool, i.e. according to the last tick transition that was run.
   * This value may not always be equal to SqrtTickMath.getTickAtSqrtRatio(price) if the price is on a tick
   * boundary.
   * @return fee The last pool fee value in hundredths of a bip, i.e. 1e-6
   * @return timepointIndex The index of the last written timepoint
   * @return communityFeeToken0 The community fee percentage of the swap fee in thousandths (1e-3) for token0
   * @return communityFeeToken1 The community fee percentage of the swap fee in thousandths (1e-3) for token1
   * @return unlocked Whether the pool is currently locked to reentrancy
   */
  function globalState()
    external
    view
    returns (
      uint160 price,
      int24 tick,
      uint16 fee,
      uint16 timepointIndex,
      uint8 communityFeeToken0,
      uint8 communityFeeToken1,
      bool unlocked
    );

  /**
   * @notice The fee growth as a Q128.128 fees of token0 collected per unit of liquidity for the entire life of the pool
   * @dev This value can overflow the uint256
   */
  function totalFeeGrowth0Token() external view returns (uint256);

  /**
   * @notice The fee growth as a Q128.128 fees of token1 collected per unit of liquidity for the entire life of the pool
   * @dev This value can overflow the uint256
   */
  function totalFeeGrowth1Token() external view returns (uint256);

  /**
   * @notice The currently in range liquidity available to the pool
   * @dev This value has no relationship to the total liquidity across all ticks.
   * Returned value cannot exceed type(uint128).max
   */
  function liquidity() external view returns (uint128);

  /**
   * @notice Look up information about a specific tick in the pool
   * @param tick The tick to look up
   * @return liquidityTotal the total amount of position liquidity that uses the pool either as tick lower or
   * tick upper
   * @return liquidityDelta how much liquidity changes when the pool price crosses the tick
   * @return outerFeeGrowth0Token the fee growth on the other side of the tick from the current tick in token0
   * @return outerFeeGrowth1Token the fee growth on the other side of the tick from the current tick in token1
   * @return outerTickCumulative the cumulative tick value on the other side of the tick from the current tick
   * @return outerSecondsPerLiquidity the seconds spent per liquidity on the other side of the tick from the current tick
   * @return outerSecondsSpent the seconds spent on the other side of the tick from the current tick
   * @return initialized Set to true if the tick is initialized, i.e. liquidityTotal is greater than 0
   * otherwise equal to false. Outside values can only be used if the tick is initialized.
   * In addition, these values are only relative and must be used only in comparison to previous snapshots for
   * a specific position.
   */
  function ticks(int24 tick)
    external
    view
    returns (
      uint128 liquidityTotal,
      int128 liquidityDelta,
      uint256 outerFeeGrowth0Token,
      uint256 outerFeeGrowth1Token,
      int56 outerTickCumulative,
      uint160 outerSecondsPerLiquidity,
      uint32 outerSecondsSpent,
      bool initialized
    );

  /** @notice Returns 256 packed tick initialized boolean values. See TickTable for more information */
  function tickTable(int16 wordPosition) external view returns (uint256);

  /**
   * @notice Returns the information about a position by the position's key
   * @param key The position's key is a hash of a preimage composed by the owner, bottomTick and topTick
   * @return liquidityAmount The amount of liquidity in the position,
   * lastLiquidityAddTimestamp Timestamp of last adding of liquidity,
   * innerFeeGrowth0Token Fee growth of token0 inside the tick range as of the last mint/burn/poke,
   * innerFeeGrowth1Token Fee growth of token1 inside the tick range as of the last mint/burn/poke,
   * fees0 The computed amount of token0 owed to the position as of the last mint/burn/poke,
   * fees1 The computed amount of token1 owed to the position as of the last mint/burn/poke
   */
  function positions(bytes32 key)
    external
    view
    returns (
      uint128 liquidityAmount,
      uint32 lastLiquidityAddTimestamp,
      uint256 innerFeeGrowth0Token,
      uint256 innerFeeGrowth1Token,
      uint128 fees0,
      uint128 fees1
    );

  /**
   * @notice Returns data about a specific timepoint index
   * @param index The element of the timepoints array to fetch
   * @dev You most likely want to use #getTimepoints() instead of this method to get an timepoint as of some amount of time
   * ago, rather than at a specific index in the array.
   * @return initialized whether the timepoint has been initialized and the values are safe to use
   * @return blockTimestamp The timestamp of the timepoint
   * @return tickCumulative the tick multiplied by seconds elapsed for the life of the pool as of the timepoint timestamp
   * @return secondsPerLiquidityCumulative the seconds per in range liquidity for the life of the pool as of the timepoint timestamp
   * @return volatilityCumulative Cumulative standard deviation for the life of the pool as of the timepoint timestamp
   * @return averageTick Time-weighted average tick
   * @return volumePerLiquidityCumulative Cumulative swap volume per liquidity for the life of the pool as of the timepoint timestamp
   */
  function timepoints(uint256 index)
    external
    view
    returns (
      bool initialized,
      uint32 blockTimestamp,
      int56 tickCumulative,
      uint160 secondsPerLiquidityCumulative,
      uint88 volatilityCumulative,
      int24 averageTick,
      uint144 volumePerLiquidityCumulative
    );

  /**
   * @notice Returns the information about active incentive
   * @dev if there is no active incentive at the moment, virtualPool,endTimestamp,startTimestamp would be equal to 0
   * @return virtualPool The address of a virtual pool associated with the current active incentive
   */
  function activeIncentive() external view returns (address virtualPool);

  /**
   * @notice Returns the lock time for added liquidity
   */
  function liquidityCooldown() external view returns (uint32 cooldownInSeconds);
}
