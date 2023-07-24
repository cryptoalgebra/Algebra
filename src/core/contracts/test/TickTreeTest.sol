// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;
pragma abicoder v1;

import '../libraries/TickTree.sol';

contract TickTreeTest {
  using TickTree for mapping(int16 => uint256);
  uint32 public root;

  mapping(int16 => uint256) public tickSecondLayer;
  mapping(int16 => uint256) public tickTable;

  function toggleTick(int24 tick) external {
    root = tickTable.toggleTick(tickSecondLayer, root, tick);
    (tickSecondLayer, tick, root);
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
    unchecked {
      uint256 gasBefore = gasleft();
      root = tickTable.toggleTick(tickSecondLayer, root, tick);
      (tickSecondLayer, tick, root);
      return gasBefore - gasleft();
    }
  }

  function nextTick(int24 tick) external view returns (int24 next, bool initialized) {
    next = tickTable.getNextTick(tickSecondLayer, root, tick);
    initialized = _isInitTick(next);
  }

  function nextTickInSameNode(uint256 node, uint8 tick) external pure returns (int24 next, bool initialized) {
    (next, initialized) = TickTree._nextActiveBitInWord(node, int24(uint24(tick)));
  }

  function getGasCostOfNextTick(int24 tick) external view returns (uint256) {
    unchecked {
      uint256 gasBefore = gasleft();
      tickTable.getNextTick(tickSecondLayer, root, tick);
      return gasBefore - gasleft();
    }
  }

  // returns whether the given tick is initialized
  function isInitialized(int24 tick) external view returns (bool) {
    return _isInitTick(tick);
  }
}
