// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;
pragma abicoder v2;

import '../libraries/DataStorage.sol';

contract DataStorageTest {
  using DataStorage for DataStorage.Timepoint[65535];

  DataStorage.Timepoint[65535] public timepoints;

  uint32 public time;
  int24 public tick;
  uint128 public liquidity;
  uint16 public index;

  struct InitializeParams {
    uint32 time;
    int24 tick;
    uint128 liquidity;
  }

  function initialize(InitializeParams calldata params) external {
    time = params.time;
    tick = params.tick;
    liquidity = params.liquidity;
    timepoints.initialize(params.time, tick);
  }

  function advanceTime(uint32 by) public {
    time += by;
  }

  struct UpdateParams {
    uint32 advanceTimeBy;
    int24 tick;
    uint128 liquidity;
  }

  // write an timepoint, then change tick and liquidity
  function update(UpdateParams calldata params) external {
    advanceTime(params.advanceTimeBy);
    index = timepoints.write(index, time, tick, liquidity, 0); //TODO: fix for testing
    tick = params.tick;
    liquidity = params.liquidity;
  }

  function batchUpdate(UpdateParams[] calldata params) external {
    // sload everything
    int24 _tick = tick;
    uint128 _liquidity = liquidity;
    uint16 _index = index;
    uint32 _time = time;

    for (uint256 i = 0; i < params.length; i++) {
      _time += params[i].advanceTimeBy;
      _index = timepoints.write(_index, _time, _tick, _liquidity, 0);
      _tick = params[i].tick;
      _liquidity = params[i].liquidity;
    }

    // sstore everything
    tick = _tick;
    liquidity = _liquidity;
    index = _index;
    time = _time;
  }

  function getTimepoints(uint32[] calldata secondsAgos)
    external
    view
    returns (
      int56[] memory tickCumulatives,
      uint160[] memory secondsPerLiquidityCumulatives,
      uint112[] memory volatilityCumulatives,
      uint256[] memory volumePerAvgLiquiditys
    )
  {
    return timepoints.getTimepoints(time, secondsAgos, tick, index, liquidity);
  }

  function getGasCostOfGetPoints(uint32[] calldata secondsAgos) external view returns (uint256) {
    (uint32 _time, int24 _tick, uint128 _liquidity, uint16 _index) = (time, tick, liquidity, index);
    uint256 gasBefore = gasleft();
    timepoints.getTimepoints(_time, secondsAgos, _tick, _index, _liquidity);
    return gasBefore - gasleft();
  }
}
