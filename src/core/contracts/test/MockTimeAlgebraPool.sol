// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../AlgebraPool.sol';

// used for testing time dependent behavior
contract MockTimeAlgebraPool is AlgebraPool {
  // Monday, October 5, 2020 9:00:00 AM GMT-05:00
  uint256 public time = 1601906400;

  function setTotalFeeGrowth0Token(uint256 _totalFeeGrowth0Token) external {
    totalFeeGrowth0Token = _totalFeeGrowth0Token;
  }

  function setTotalFeeGrowth1Token(uint256 _totalFeeGrowth1Token) external {
    totalFeeGrowth1Token = _totalFeeGrowth1Token;
  }

  function advanceTime(uint256 by) external {
    time += by;
  }

  function _blockTimestamp() internal view override returns (uint32) {
    return uint32(time);
  }

  function checkBlockTimestamp() external view returns (bool) {
    require(super._blockTimestamp() == uint32(block.timestamp));
    return true;
  }

  function getAverages() external view returns (uint112 TWVolatilityAverage, uint256 TWVolumePerLiqAverage) {
    (TWVolatilityAverage, TWVolumePerLiqAverage) = IDataStorageOperator(dataStorageOperator).getAverages(
      _blockTimestamp(),
      globalState.fee,
      globalState.timepointIndex,
      liquidity
    );
  }

  function getPrevTick() external view returns (int24 tick, int24 currentTick) {
    if (globalState.timepointIndex > 2) {
      (, uint32 lastTsmp, int56 tickCum, , , , ) = IDataStorageOperator(dataStorageOperator).timepoints(globalState.timepointIndex);
      (, uint32 plastTsmp, int56 ptickCum, , , , ) = IDataStorageOperator(dataStorageOperator).timepoints(globalState.timepointIndex - 1);
      tick = int24((tickCum - ptickCum) / (lastTsmp - plastTsmp));
    }
    currentTick = globalState.tick;
  }

  function getFee() external view returns (uint16 fee) {
    return IDataStorageOperator(dataStorageOperator).getFee(_blockTimestamp(), globalState.tick, globalState.timepointIndex, liquidity);
  }

  function getKeyForPosition(
    address owner,
    int24 bottomTick,
    int24 topTick
  ) external pure returns (bytes32 key) {
    assembly {
      key := or(shl(24, or(shl(24, owner), and(bottomTick, 0xFFFFFF))), and(topTick, 0xFFFFFF))
    }
  }
}
