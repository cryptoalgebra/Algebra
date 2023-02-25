// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import './AlgebraPoolBase.sol';

abstract contract ReentrancyGuard is AlgebraPoolBase {
  modifier nonReentrant() {
    _lock();
    _;
    _unlock();
  }

  function _lock() private {
    if (!globalState.unlocked) revert IAlgebraPoolErrors.locked();
    globalState.unlocked = false;
  }

  function _unlock() private {
    globalState.unlocked = true;
  }
}
