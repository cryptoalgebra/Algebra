// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;
pragma abicoder v1;

import '../../libraries/TickTree.sol';

contract TickTreeSearchEchidnaTest {
  using TickTree for mapping(int16 => uint256);
  uint32 private tickTreeRoot;

  mapping(int16 => uint256) private tickSecondLayerBitmap;
  mapping(int16 => uint256) private tickBitmap;

  int24[] initedTicks;
  mapping(int24 => uint256) initedTicksIndexes;

  // returns whether the given tick is initialized
  function _isInitialized(int24 tick) private view returns (bool) {
    int16 rowNumber;
    uint8 bitNumber;

    assembly {
      bitNumber := and(tick, 0xFF)
      rowNumber := sar(8, tick)
    }
    uint256 word0 = tickBitmap[rowNumber];
    unchecked {
      return (word0 & (1 << bitNumber)) > 0;
    }
  }

  function toggleTick(int24 tick) external {
    unchecked {
      if (tick < TickMath.MIN_TICK) tick = TickMath.MIN_TICK;
      if (tick > TickMath.MAX_TICK) tick = TickMath.MAX_TICK;

      assert(tick >= TickMath.MIN_TICK);
      assert(tick <= TickMath.MAX_TICK);
      bool before = _isInitialized(tick);
      tickTreeRoot = tickBitmap.toggleTick(tickSecondLayerBitmap, tickTreeRoot, tick);
      assert(_isInitialized(tick) == !before);

      if (!before) {
        initedTicks.push(tick);
        initedTicksIndexes[tick] = initedTicks.length - 1;
      } else {
        uint256 index = initedTicksIndexes[tick];
        if (index != initedTicks.length - 1) {
          int24 last = initedTicks[initedTicks.length - 1];
          initedTicks[index] = last;
          initedTicksIndexes[last] = index;
        }
        initedTicks.pop();
      }
    }
  }

  function _findNextTickInArray(int24 start) private view returns (int24 num, bool found) {
    uint256 length = initedTicks.length;
    if (length == 0) return (TickMath.MAX_TICK, false);
    num = TickMath.MAX_TICK;
    unchecked {
      for (uint256 i; i < length; ++i) {
        int24 tick = initedTicks[i];
        if (tick > start) {
          if (tick <= num) {
            num = tick;
            found = true;
          }
        }
      }
    }
  }

  function checkNextInitializedTickInvariants(int24 tick) external view {
    unchecked {
      if (tick < TickMath.MIN_TICK) tick = TickMath.MIN_TICK;
      if (tick >= TickMath.MAX_TICK) tick = TickMath.MAX_TICK;

      int24 next = tickBitmap.getNextTick(tickSecondLayerBitmap, tickTreeRoot, tick);

      if (tick == TickMath.MAX_TICK) {
        assert(next == TickMath.MAX_TICK);
      } else {
        assert(next > tick);
        assert((next - tick) <= 2 * TickMath.MAX_TICK);
        assert(next >= TickMath.MIN_TICK);
        assert(next <= TickMath.MAX_TICK);
        if (next != TickMath.MAX_TICK) assert(_isInitialized(next));
        // all the ticks between the input tick and the next tick should be uninitialized
        (int24 nextInited, bool found) = _findNextTickInArray(tick);
        assert(nextInited == next);
        assert(_isInitialized(next) == found);
      }
    }
  }
}
