// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import './AlgebraPoolBase.sol';

/// @title Algebra reentrancy protection
/// @notice Provides a modifier that protects against reentrancy
abstract contract ReentrancyGuard is AlgebraPoolBase {
  /// @notice checks that reentrancy lock is unlocked
  modifier onlyUnlocked() {
    _checkUnlocked();
    _;
  }

  /// @dev using private function to save bytecode
  function _checkUnlocked() internal view {
    if (!globalState.unlocked) revert IAlgebraPoolErrors.locked();
  }

  /// @dev using private function to save bytecode
  function _lock() internal {
    if (!globalState.unlocked) revert IAlgebraPoolErrors.locked();
    globalState.unlocked = false;
  }

  /// @dev using private function to save bytecode
  function _unlock() internal {
    globalState.unlocked = true;
  }
}
