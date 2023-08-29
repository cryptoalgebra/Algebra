// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../libraries/VolatilityOracle.sol';
import '../interfaces/plugins/IVolatilityOracle.sol';

contract MockVolatilityOracle is IVolatilityOracle {
  VolatilityOracle.Timepoint[2] public override timepoints;

  bool public isInitialized;

  constructor(uint32[] memory secondsAgos, int56[] memory tickCumulatives) {
    require(secondsAgos.length == 2 && tickCumulatives.length == 2, 'Invalid test case size');

    timepoints[0].blockTimestamp = secondsAgos[0];
    timepoints[0].tickCumulative = tickCumulatives[0];

    timepoints[1].blockTimestamp = secondsAgos[1];
    timepoints[1].tickCumulative = tickCumulatives[1];

    isInitialized = true;
  }

  function getTimepoints(
    uint32[] calldata secondsAgos
  ) external view override returns (int56[] memory tickCumulatives, uint112[] memory volatilityCumulatives) {
    require(secondsAgos[0] == timepoints[0].blockTimestamp && secondsAgos[1] == timepoints[1].blockTimestamp, 'Invalid test case');

    int56[] memory _tickCumulatives = new int56[](2);
    uint112[] memory _volatilityCumulatives = new uint112[](2);

    _tickCumulatives[0] = timepoints[0].tickCumulative;
    _volatilityCumulatives[0] = timepoints[0].volatilityCumulative;

    _tickCumulatives[1] = timepoints[1].tickCumulative;
    _volatilityCumulatives[1] = timepoints[1].volatilityCumulative;

    return (_tickCumulatives, _volatilityCumulatives);
  }

  function timepointIndex() external view override returns (uint16) {}

  function lastTimepointTimestamp() external view override returns (uint32) {}

  function getSingleTimepoint(uint32 secondsAgo) external view override returns (int56 tickCumulative, uint112 volatilityCumulative) {}

  function prepayTimepointsStorageSlots(uint16 startIndex, uint16 amount) external override {}
}
