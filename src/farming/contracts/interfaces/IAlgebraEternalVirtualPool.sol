// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.4;

import '@cryptoalgebra/farming-proxy-plugin/contracts/interfaces/IAlgebraVirtualPool.sol';

/// @title Algebra eternal virtual pool interface
/// @notice Used to track active liquidity in farming and calculate total fees earned by farming positions
interface IAlgebraEternalVirtualPool is IAlgebraVirtualPool {
  error onlyPlugin();
  error onlyFarming();

  /// @notice Returns address of the AlgebraEternalFarming
  function farmingAddress() external view returns (address);

  /// @notice Returns address of the plugin for which this virtual pool was created
  function plugin() external view returns (address);

  /// @notice Returns the address of the real pool
  function pool() external view returns (address);

  /// @notice Returns data associated with a tick
  /// @param tickId The tick to get data for
  /// @return liquidityTotal The total liquidity referencing this tick
  /// @return liquidityDelta The liquidity delta when crossing this tick
  /// @return prevTick The previous initialized tick
  /// @return nextTick The next initialized tick
  /// @return outerFeeGrowth0Token The outer fee growth for token0 (saved from real pool)
  /// @return outerFeeGrowth1Token The outer fee growth for token1 (saved from real pool)
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

  /// @notice Returns the accumulated fees earned by all positions in farming
  /// @dev Should be called after updateTotalFees() to get actual value
  /// @return totalFees0 The accumulated fees in token0
  /// @return totalFees1 The accumulated fees in token1
  function getTotalFees() external view returns (uint256 totalFees0, uint256 totalFees1);

  /// @notice Updates totalFees to account for swaps without tick crosses
  /// @dev Should be called before reading totalFees to get accurate values
  function updateTotalFees() external;

  /// @notice This function is called when anyone changes their farmed liquidity
  /// @dev The position in a virtual pool should be changed accordingly.
  /// If the virtual pool is deactivated, does nothing.
  /// @param bottomTick The bottom tick of a position
  /// @param topTick The top tick of a position
  /// @param liquidityDelta The amount of liquidity in a position
  /// @param currentTick The current tick in the main pool
  function applyLiquidityDeltaToPosition(int24 bottomTick, int24 topTick, int128 liquidityDelta, int24 currentTick) external;

  /// @notice This function is used to deactivate virtual pool
  /// @dev Can only be called by farming
  function deactivate() external;
}
