// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import './AlgebraPoolBase.sol';

/// @title Algebra reentrancy protection
/// @notice Provides a modifier that protects against reentrancy
abstract contract ReentrancyGuard is AlgebraPoolBase {
  modifier nonReentrant() {
    _lock();
    _;
    _unlock();
  }

  /// @dev using private function to save bytecode
  function _lock() private {
    if (!globalState.unlocked) revert IAlgebraPoolErrors.locked();
    globalState.unlocked = false;
  }

  /// @dev using private function to save bytecode
  function _unlock() private {
    globalState.unlocked = true;
  }
}
