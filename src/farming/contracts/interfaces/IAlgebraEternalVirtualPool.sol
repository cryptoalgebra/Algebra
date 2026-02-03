// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.4;

import '@cryptoalgebra/farming-proxy-plugin/contracts/interfaces/IAlgebraVirtualPool.sol';

/// @title Algebra eternal virtual pool interface
/// @notice Used to track active liquidity in farming and distribute rewards based on collected fees
interface IAlgebraEternalVirtualPool { // TODO: return to IAlgebraVirtualPool inheritance
  error onlyPlugin();
  error onlyFarming();

  /// @notice Called by plugin after each tick crossing during swap
  ///      and crosses the tick in virtual pool if it exists
  /// @param zeroToOne Direction of the swap 
  /// @param feeAmount Amount of fee collected in input token
  /// @param tick The tick that was crossed
  /// @param poolLiquidity Current liquidity in the main pool
  function afterCross(
    bool zeroToOne,
    uint256 feeAmount,
    int24 tick,
    uint128 poolLiquidity
  ) external;

  /// @notice Called by plugin after swap to record remaining accumulated fees
  /// @param zeroToOne Direction of the swap 
  /// @param feeAmount Remaining accumulated fee since last cross
  /// @param currentTick Current tick after swap
  /// @param poolLiquidity Current liquidity in the main pool
  function afterSwap(
    bool zeroToOne,
    uint256 feeAmount,
    int24 currentTick,
    uint128 poolLiquidity
  ) external;

  /// @notice Returns the accumulated fee growth for token0
  function totalFeeGrowth0() external view returns (uint256);

  /// @notice Returns the accumulated fee growth for token1
  function totalFeeGrowth1() external view returns (uint256);

  /// @notice Returns total absolute fees collected in token0
  function totalFees0Collected() external view returns (uint256);

  /// @notice Returns total absolute fees collected in token1
  function totalFees1Collected() external view returns (uint256);

  /// @dev Used to calculate rewards for a specific position
  /// @param bottomTick Lower tick of the position
  /// @param topTick Upper tick of the position
  /// @return feeGrowthInside0 Fee growth inside for token0
  /// @return feeGrowthInside1 Fee growth inside for token1
  function getInnerFeeGrowth(int24 bottomTick, int24 topTick) external view returns (uint256 feeGrowthInside0, uint256 feeGrowthInside1);

  /// @notice Returns address of the AlgebraEternalFarming
  function farmingAddress() external view returns (address);

  /// @notice Returns address of the plugin for which this virtual pool was created
  function plugin() external view returns (address);

  /// @notice Returns data associated with a tick
  /// @dev outerFeeGrowth0Token tracks token0 fees, outerFeeGrowth1Token tracks token1 fees
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

  /// @notice This function is used to deactivate virtual pool
  /// @dev Can only be called by farming
  function deactivate() external;
}
