// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../libraries/TickTable.sol';

contract TickTableTest {
  using TickTable for mapping(int16 => uint256);

  mapping(int16 => uint256) public bitmap;

  function toggleTick(int24 tick) external {
    bitmap.toggleTick(tick);
  }

  function getGasCostOfFlipTick(int24 tick) external returns (uint256) {
    uint256 gasBefore = gasleft();
    bitmap.toggleTick(tick);
    return gasBefore - gasleft();
  }

  function nextTickInTheSameRow(int24 tick, bool lte) external view returns (int24 next, bool initialized) {
    return bitmap.nextTickInTheSameRow(tick, lte);
  }

  function getGasCostOfNextTickInTheSameRow(int24 tick, bool lte) external view returns (uint256) {
    uint256 gasBefore = gasleft();
    bitmap.nextTickInTheSameRow(tick, lte);
    return gasBefore - gasleft();
  }

  // returns whether the given tick is initialized
  function isInitialized(int24 tick) external view returns (bool) {
    (int24 next, bool initialized) = bitmap.nextTickInTheSameRow(tick, true);
    return next == tick ? initialized : false;
  }
}
