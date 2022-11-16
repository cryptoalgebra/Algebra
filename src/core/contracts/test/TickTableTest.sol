// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../libraries/TickTable.sol';

contract TickTableTest {
  using TickTable for mapping(int16 => uint256);
  uint256 public word;

  mapping(int16 => uint256) public tickWordsTable;
  mapping(int16 => uint256) public tickTable;

  function toggleTick(int24 tick) external {
    bool toggle = tickTable.toggleTick(tick);

    if (toggle) word = tickWordsTable.writeWord(tick, word);
  }

  function _isInitTick(int24 tick) private view returns (bool) {
    int16 rowNumber;
    uint8 bitNumber;

    assembly {
      bitNumber := and(tick, 0xFF)
      rowNumber := sar(8, tick)
    }

    return ((tickTable[rowNumber] & (1 << bitNumber)) > 0);
  }

  function getGasCostOfFlipTick(int24 tick) external returns (uint256) {
    uint256 gasBefore = gasleft();
    tickTable.toggleTick(tick);
    return gasBefore - gasleft();
  }

  function nextTickInTheSameRow(int24 tick, bool lte) external view returns (int24 next, bool initialized) {
    next = tickTable.getNextTick(tickWordsTable, word, tick);
    initialized = _isInitTick(next);
  }

  function getGasCostOfNextTickInTheSameRow(int24 tick, bool lte) external view returns (uint256) {
    uint256 gasBefore = gasleft();
    tickTable.getNextTick(tickWordsTable, word, tick);
    return gasBefore - gasleft();
  }

  // returns whether the given tick is initialized
  function isInitialized(int24 tick) external view returns (bool) {
    return _isInitTick(tick);
  }
}
