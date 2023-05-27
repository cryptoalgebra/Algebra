// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.17;
pragma abicoder v1;

import '../libraries/TickTree.sol';

contract TickTreeTest {
  using TickTree for mapping(int16 => uint256);
  uint256 public word;

  mapping(int16 => uint256) public tickWordsTable;
  mapping(int16 => uint256) public tickTree;

  function toggleTick(int24 tick) external {
    word = tickTree.toggleTick(tickWordsTable, tick, word);
    (tickWordsTable, tick, word);
  }

  function _isInitTick(int24 tick) private view returns (bool) {
    int16 rowNumber;
    uint8 bitNumber;

    assembly {
      bitNumber := and(tick, 0xFF)
      rowNumber := sar(8, tick)
    }

    return ((tickTree[rowNumber] & (1 << bitNumber)) > 0);
  }

  function getGasCostOfFlipTick(int24 tick) external returns (uint256) {
    unchecked {
      uint256 gasBefore = gasleft();
      word = tickTree.toggleTick(tickWordsTable, tick, word);
      (tickWordsTable, tick, word);
      return gasBefore - gasleft();
    }
  }

  function nextTickInTheSameNode(int24 tick) external view returns (int24 next, bool initialized) {
    next = tickTree.getNextTick(tickWordsTable, word, tick);
    initialized = _isInitTick(next);
  }

  function getGasCostOfNextTickInTheSameNode(int24 tick) external view returns (uint256) {
    unchecked {
      uint256 gasBefore = gasleft();
      tickTree.getNextTick(tickWordsTable, word, tick);
      return gasBefore - gasleft();
    }
  }

  // returns whether the given tick is initialized
  function isInitialized(int24 tick) external view returns (bool) {
    return _isInitTick(tick);
  }
}
