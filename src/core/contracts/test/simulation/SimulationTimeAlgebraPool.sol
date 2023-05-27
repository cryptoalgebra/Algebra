// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.17;

import '../../AlgebraPool.sol';
import '../MockTimeDataStorageOperator.sol';

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
    volatilityAverage = MockTimeDataStorageOperator(dataStorageOperator).getAverageVolatility(
      _blockTimestamp(),
      int24(uint24(globalState.fee)),
      globalState.timepointIndex
    );
  }
}
