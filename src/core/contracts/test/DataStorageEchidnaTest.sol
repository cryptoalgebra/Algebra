// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.17;

import './DataStorageTest.sol';

contract DataStorageEchidnaTest {
  DataStorageTest private dataStorage;

  bool private initialized;
  uint32 private timePassed;

  constructor() {
    dataStorage = new DataStorageTest();
  }

  function initialize(uint32 time, int24 tick, uint128 liquidity) external {
    require(tick % 60 == 0);
    dataStorage.initialize(DataStorageTest.InitializeParams({time: time, tick: tick, liquidity: liquidity}));
    initialized = true;
  }

  function limitTimePassed(uint32 by) private {
    unchecked {
      require(timePassed + by >= timePassed);
      timePassed += by;
    }
  }

  function advanceTime(uint32 by) public {
    limitTimePassed(by);
    dataStorage.advanceTime(by);
  }

  // write a timepoint, then change tick and liquidity
  function update(uint32 advanceTimeBy, int24 tick, uint128 liquidity) external {
    require(initialized);
    limitTimePassed(advanceTimeBy);
    dataStorage.update(DataStorageTest.UpdateParams({advanceTimeBy: advanceTimeBy, tick: tick, liquidity: liquidity}));
  }

  function checkTimeWeightedResultAssertions(uint32 secondsAgo0, uint32 secondsAgo1) private view {
    unchecked {
      require(secondsAgo0 != secondsAgo1);
      require(initialized);
      // secondsAgo0 should be the larger one
      if (secondsAgo0 < secondsAgo1) (secondsAgo0, secondsAgo1) = (secondsAgo1, secondsAgo0);

      uint32 timeElapsed = secondsAgo0 - secondsAgo1;

      uint32[] memory secondsAgos = new uint32[](2);
      secondsAgos[0] = secondsAgo0;
      secondsAgos[1] = secondsAgo1;

      (int56[] memory tickCumulatives, ) = dataStorage.getTimepoints(secondsAgos);
      int56 timeWeightedTick = (tickCumulatives[1] - tickCumulatives[0]) / int56(uint56(timeElapsed));
      assert(timeWeightedTick <= type(int24).max);
      assert(timeWeightedTick >= type(int24).min);
    }
  }

  function echidna_indexAlwaysLtCardinality() external view returns (bool) {
    return dataStorage.index() < 65536 || !initialized;
  }

  function echidna_avgTickNotOverflows() external view returns (bool) {
    int256 res = dataStorage.getAverageTick();
    return (res <= type(int24).max && res >= type(int24).min);
  }

  function echidna_canAlwaysGetPoints0IfInitialized() external view returns (bool) {
    if (!initialized) {
      return true;
    }
    uint32[] memory arr = new uint32[](1);
    arr[0] = 0;
    (bool success, ) = address(dataStorage).staticcall(abi.encodeWithSelector(DataStorageTest.getTimepoints.selector, arr));
    return success;
  }

  function checkVolatilityOnRangeNotOverflowUint88(uint32 dt, int24 tick0, int24 tick1, int24 avgTick0, int24 avgTick1) external view {
    uint256 res = dataStorage.volatilityOnRange(dt, tick0, tick1, avgTick0, avgTick1);
    assert(res <= type(uint88).max);
  }

  function checkTwoAdjacentTimepointsTickCumulativeModTimeElapsedAlways0(uint16 index) external view {
    unchecked {
      // check that the timepoints are initialized, and that the index is not the oldest timepoint
      require(index < 65536 && index != (dataStorage.index() + 1) % 65536);

      (bool initialized0, uint32 blockTimestamp0, int56 tickCumulative0, , , , ) = dataStorage.timepoints(index == 0 ? 65536 - 1 : index - 1);
      (bool initialized1, uint32 blockTimestamp1, int56 tickCumulative1, , , , ) = dataStorage.timepoints(index);

      require(initialized0);
      require(initialized1);

      uint32 timeElapsed = blockTimestamp1 - blockTimestamp0;
      assert(timeElapsed > 0);
      assert((tickCumulative1 - tickCumulative0) % int56(uint56(timeElapsed)) == 0);
    }
  }

  function checkTimeWeightedAveragesAlwaysFitsType(uint32 secondsAgo) external view {
    require(initialized);
    require(secondsAgo > 0);
    uint32[] memory secondsAgos = new uint32[](2);
    secondsAgos[0] = secondsAgo;
    secondsAgos[1] = 0;
    (int56[] memory tickCumulatives, ) = dataStorage.getTimepoints(secondsAgos);

    // compute the time weighted tick, rounded towards negative infinity
    unchecked {
      int56 numerator = tickCumulatives[1] - tickCumulatives[0];
      int56 timeWeightedTick = numerator / int56(uint56(secondsAgo));
      if (numerator < 0 && numerator % int56(uint56(secondsAgo)) != 0) {
        timeWeightedTick--;
      }

      // the time weighted averages fit in their respective accumulated types
      assert(timeWeightedTick <= type(int24).max && timeWeightedTick >= type(int24).min);
    }
  }
}
