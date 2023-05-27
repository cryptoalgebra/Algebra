// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title The interface for the virtual pool
/// @dev Used to calculate active liquidity in farmings
interface IAlgebraVirtualPool {
  /// @dev This function is called by the main pool if an initialized ticks are crossed by swap.
  /// If any one of crossed ticks is also initialized in a virtual pool it should be crossed too
  /// @param targetTick The target tick up to which we need to cross all active ticks
  /// @param zeroToOne The direction
  function crossTo(int24 targetTick, bool zeroToOne) external returns (bool success);
}
