// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../../AlgebraPool.sol';

// used for testing time dependent behavior
contract SimulationTimeAlgebraPool is AlgebraPool {
  // Monday, October 5, 2020 9:00:00 AM GMT-05:00
  uint256 public time = 1601906400;

  function advanceTime(uint256 by) external {
    time += by;
  }

  function _blockTimestamp() internal view override returns (uint32) {
    return uint32(time);
  }

  function getAverageVolatility() external view returns (uint112 volatilityAverage) {
    volatilityAverage = IDataStorageOperator(dataStorageOperator).getAverageVolatility(
      _blockTimestamp(),
      globalState.fee,
      globalState.timepointIndex
    );
  }
}
