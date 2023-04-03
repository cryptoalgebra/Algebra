// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;
pragma abicoder v2;

import '../base/AlgebraFeeConfiguration.sol';

/// @title The interface for the DataStorageOperator
/// @dev This contract stores timepoints and calculates adaptive fee and statistical averages
interface IDataStorageOperator {
  /// @notice Emitted when the fee configuration is changed
  /// @param feeConfig The structure with dynamic fee parameters
  /// @dev See the AdaptiveFee library for more details
  event FeeConfiguration(AlgebraFeeConfiguration feeConfig);

  /// @notice Returns data belonging to a certain timepoint
  /// @param index The index of timepoint in the array
  /// @dev There is more convenient function to fetch a timepoint: getTimepoints(). Which requires not an index but seconds
  /// @return initialized Whether the timepoint has been initialized and the values are safe to use
  /// @return blockTimestamp The timestamp of the timepoint
  /// @return tickCumulative The tick multiplied by seconds elapsed for the life of the pool as of the timepoint timestamp
  /// @return volatilityCumulative Cumulative standard deviation for the life of the pool as of the timepoint timestamp
  /// @return tick The tick at blockTimestamp
  /// @return averageTick Time-weighted average tick
  /// @return windowStartIndex Index of closest timepoint >= WINDOW seconds ago
  function timepoints(
    uint256 index
  )
    external
    view
    returns (
      bool initialized,
      uint32 blockTimestamp,
      int56 tickCumulative,
      uint88 volatilityCumulative,
      int24 tick,
      int24 averageTick,
      uint16 windowStartIndex
    );

  /// @notice Initialize the dataStorage array by writing the first slot. Called once for the lifecycle of the timepoints array
  /// @param time The time of the dataStorage initialization, via block.timestamp truncated to uint32
  /// @param tick Initial tick
  function initialize(uint32 time, int24 tick) external;

  /// @dev Reverts if a timepoint at or before the desired timepoint timestamp does not exist.
  /// 0 may be passed as `secondsAgo' to return the current cumulative values.
  /// If called with a timestamp falling between two timepoints, returns the counterfactual accumulator values
  /// at exactly the timestamp between the two timepoints.
  /// @param time The current block timestamp
  /// @param secondsAgo The amount of time to look back, in seconds, at which point to return a timepoint
  /// @param tick The current tick
  /// @param index The index of the timepoint that was most recently written to the timepoints array
  /// @return tickCumulative The cumulative tick since the pool was first initialized, as of `secondsAgo`
  /// @return volatilityCumulative The cumulative volatility value since the pool was first initialized, as of `secondsAgo`
  function getSingleTimepoint(
    uint32 time,
    uint32 secondsAgo,
    int24 tick,
    uint16 index
  ) external view returns (int56 tickCumulative, uint112 volatilityCumulative);

  /// @notice Returns the accumulator values as of each time seconds ago from the given time in the array of `secondsAgos`
  /// @dev Reverts if `secondsAgos` > oldest timepoint
  /// @param secondsAgos Each amount of time to look back, in seconds, at which point to return a timepoint
  /// @return tickCumulatives The cumulative tick since the pool was first initialized, as of each `secondsAgo`
  /// @return volatilityCumulatives The cumulative volatility values since the pool was first initialized, as of each `secondsAgo`
  function getTimepoints(uint32[] memory secondsAgos) external view returns (int56[] memory tickCumulatives, uint112[] memory volatilityCumulatives);

  /// @notice Writes a dataStorage timepoint to the array
  /// @dev Writable at most once per block. Index represents the most recently written element. index must be tracked externally.
  /// @param index The index of the timepoint that was most recently written to the timepoints array
  /// @param blockTimestamp The timestamp of the new timepoint
  /// @param tick The active tick at the time of the new timepoint
  /// @return indexUpdated The new index of the most recently written element in the dataStorage array
  /// @return newFee The fee in hundredths of a bip, i.e. 1e-6
  function write(uint16 index, uint32 blockTimestamp, int24 tick) external returns (uint16 indexUpdated, uint16 newFee);

  /// @notice Changes fee configuration for the pool
  function changeFeeConfiguration(AlgebraFeeConfiguration calldata feeConfig) external;

  /// @notice Fills uninitialized timepoints with nonzero value
  /// @dev Can be used to reduce the gas cost of future swaps
  /// @param startIndex The start index, must be not initialized
  /// @param amount of slots to fill, startIndex + amount must be <= type(uint16).max
  function prepayTimepointsStorageSlots(uint16 startIndex, uint16 amount) external;
}
