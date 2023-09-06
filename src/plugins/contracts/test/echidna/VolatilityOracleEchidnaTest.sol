// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import './../VolatilityOracleTest.sol';

contract VolatilityOracleEchidnaTest {
  uint256 internal constant UINT16_MODULO = 65536;

  VolatilityOracleTest private volatilityOracle;

  bool private initialized;
  uint32 private timePassed;

  constructor() {
    volatilityOracle = new VolatilityOracleTest();
  }

  function initialize(uint32 time, int24 tick) external {
    require(!initialized);
    initialized = true;
    if (tick % 60 != 0) tick = (tick / 60) * 60;
    volatilityOracle.initialize(VolatilityOracleTest.InitializeParams({time: time, tick: tick}));
  }

  function _limitTimePassed(uint32 by) private {
    unchecked {
      require(timePassed + by >= timePassed);
      timePassed += by;
    }
  }

  function advanceTime(uint32 by) public {
    _limitTimePassed(by);
    volatilityOracle.advanceTime(by);
  }

  // write a timepoint, then change tick and liquidity
  function update(uint32 advanceTimeBy, int24 tick) external {
    require(initialized);
    _limitTimePassed(advanceTimeBy);
    volatilityOracle.update(VolatilityOracleTest.UpdateParams({advanceTimeBy: advanceTimeBy, tick: tick}));
  }

  function checkAveragesNotOverflow() external view {
    require(initialized);
    int256 tick = volatilityOracle.getAverageTick();
    assert(tick <= type(int24).max);
    assert(tick >= type(int24).min);
  }

  function checkTimeWeightedResultAssertions(uint32 secondsAgo0, uint32 secondsAgo1) external view {
    unchecked {
      require(initialized);
      // secondsAgo0 should be the larger one
      if (secondsAgo0 < secondsAgo1) (secondsAgo0, secondsAgo1) = (secondsAgo1, secondsAgo0);

      uint32 timeElapsed = secondsAgo0 - secondsAgo1;
      if (timeElapsed > 0) {
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = secondsAgo0;
        secondsAgos[1] = secondsAgo1;

        (int56[] memory tickCumulatives, uint88[] memory volatilityCumulatives) = volatilityOracle.getTimepoints(secondsAgos);

        int56 timeWeightedTick = (tickCumulatives[1] - tickCumulatives[0]) / int56(uint56(timeElapsed));
        uint112 averageVolatility = (uint112(volatilityCumulatives[1]) - uint112(volatilityCumulatives[0])) / uint112(timeElapsed);

        assert(timeWeightedTick <= type(int24).max);
        assert(timeWeightedTick >= type(int24).min);

        uint32 currentTime = volatilityOracle.time();
        (, uint32 lastTimestamp, , , , , ) = volatilityOracle.timepoints(volatilityOracle.index());

        // we should not compare volatilityCumulative for timestamps after last timepoint
        if (!(currentTime - secondsAgo0 >= lastTimestamp && currentTime - secondsAgo1 >= lastTimestamp)) {
          assert(averageVolatility <= type(uint88).max);
        }
      }
    }
  }

  function checkTwoAdjacentTimepointsTickCumulativeModTimeElapsedAlways0(uint16 index) external view {
    unchecked {
      require(initialized);
      // check that the timepoints are initialized, and that the index is not the oldest timepoint
      uint16 oldestIndex = volatilityOracle.getOldestIndex();
      require(index != oldestIndex);

      (bool initialized0, uint32 blockTimestamp0, int56 tickCumulative0, , , , ) = volatilityOracle.timepoints(index - 1);
      (bool initialized1, uint32 blockTimestamp1, int56 tickCumulative1, , , , ) = volatilityOracle.timepoints(index);

      if (!initialized0 || !initialized1) return;

      uint32 timeElapsed = blockTimestamp1 - blockTimestamp0;
      assert(timeElapsed > 0);
      assert((tickCumulative1 - tickCumulative0) % int56(uint56(timeElapsed)) == 0);
    }
  }

  function checkTimeWeightedAveragesAlwaysFitsType(uint32 secondsAgo) external view {
    require(initialized);
    if (secondsAgo == 0) return;
    uint32[] memory secondsAgos = new uint32[](2);
    secondsAgos[0] = secondsAgo;
    secondsAgos[1] = 0;
    (int56[] memory tickCumulatives, uint88[] memory volatilityCumulatives) = volatilityOracle.getTimepoints(secondsAgos);

    // compute the time weighted tick, rounded towards negative infinity
    unchecked {
      int56 numerator = tickCumulatives[1] - tickCumulatives[0];
      int56 timeWeightedTick = numerator / int56(uint56(secondsAgo));
      if (numerator < 0 && numerator % int56(uint56(secondsAgo)) != 0) {
        timeWeightedTick--;
      }

      uint112 volatility = (uint112(volatilityCumulatives[1]) - uint112(volatilityCumulatives[0])) / uint112(secondsAgo);

      // the time weighted averages fit in their respective accumulated types
      assert(timeWeightedTick <= type(int24).max && timeWeightedTick >= type(int24).min);

      uint32 currentTime = volatilityOracle.time();
      (, uint32 lastTimestamp, , , , , ) = volatilityOracle.timepoints(volatilityOracle.index());

      // we should not compare volatilityCumulative for timestamps after last timepoint
      if (!(currentTime >= lastTimestamp && currentTime - secondsAgo >= lastTimestamp)) {
        assert(volatility <= type(uint88).max);
      }
    }
  }
}
