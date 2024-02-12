// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;
pragma abicoder v1;

import '../../libraries/TickTree.sol';

contract TickTreeEchidnaTest {
  using TickTree for mapping(int16 => uint256);
  uint32 private tickTreeRoot;

  mapping(int16 => uint256) private tickSecondLayerBitmap;
  mapping(int16 => uint256) private tickBitmap;

  function _getPositionInBitmap(int24 tick) private pure returns (int16 wordIndex, uint8 bitIndex) {
    assembly {
      wordIndex := sar(8, tick)
      bitIndex := and(tick, 0xFF)
    }
  }

  function _getWord(int24 tick) private view returns (uint256) {
    int16 rowNumber;
    assembly {
      rowNumber := sar(8, tick)
    }

    return tickBitmap[rowNumber];
  }

  function _getSecondLayerWord(int24 bit) private view returns (uint256) {
    int16 rowNumber;
    assembly {
      rowNumber := sar(8, bit)
    }
    rowNumber += TickTree.SECOND_LAYER_OFFSET;
    assembly {
      rowNumber := sar(8, rowNumber)
    }

    return tickSecondLayerBitmap[rowNumber];
  }

  function _boundTick(int24 tick) private pure returns (int24) {
    if (tick < TickMath.MIN_TICK) tick = TickMath.MIN_TICK;
    if (tick > TickMath.MAX_TICK) tick = TickMath.MAX_TICK;
    return tick;
  }

  function checkToggleUntoggleTick(int24 tick) external {
    tick = _boundTick(tick);

    uint256 wordBefore = _getWord(tick);
    uint256 secondLayerWordBefore = _getSecondLayerWord(tick);
    uint32 tickTreeRootBefore = tickTreeRoot;

    tickTreeRoot = tickBitmap.toggleTick(tickSecondLayerBitmap, tickTreeRootBefore, tick);
    assert(_getWord(tick) != wordBefore);
    if (wordBefore == 0) assert(_getSecondLayerWord(tick) != secondLayerWordBefore);
    if (secondLayerWordBefore == 0) assert(tickTreeRoot != tickTreeRootBefore);

    tickTreeRoot = tickBitmap.toggleTick(tickSecondLayerBitmap, tickTreeRoot, tick);
    assert(_getWord(tick) == wordBefore);
    assert(_getSecondLayerWord(tick) == secondLayerWordBefore);
    assert(tickTreeRoot == tickTreeRootBefore);
  }

  function checkTicksForCollisions(int24 tick0, int24 tick1) external pure {
    (tick0, tick1) = (_boundTick(tick0), _boundTick(tick1));
    if (tick0 == tick1) return;

    (int16 wordIndex0, uint8 bitIndex0) = _getPositionInBitmap(tick0);
    (int16 wordIndex1, uint8 bitIndex1) = _getPositionInBitmap(tick1);

    if (wordIndex0 == wordIndex1) {
      assert(bitIndex0 != bitIndex1);
    } else {
      // second layer indexes
      (int16 slWordIndex0, uint8 slBitIndex0) = _getPositionInBitmap(wordIndex0 + TickTree.SECOND_LAYER_OFFSET);
      (int16 slWordIndex1, uint8 slBitIndex1) = _getPositionInBitmap(wordIndex1 + TickTree.SECOND_LAYER_OFFSET);

      if (slWordIndex0 == slWordIndex1) {
        assert(slBitIndex0 != slBitIndex1);
      }
    }
  }
}
