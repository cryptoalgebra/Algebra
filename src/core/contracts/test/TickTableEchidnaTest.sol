// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../libraries/TickTable.sol';

contract TickTableEchidnaTest {
  using TickTable for mapping(int16 => uint256);
  uint256 private word;

  mapping(int16 => uint256) private tickWordsTable;
  mapping(int16 => uint256) private bitmap;

  // returns whether the given tick is initialized
  function isInitialized(int24 tick) private view returns (bool) {
    int16 rowNumber;
    uint8 bitNumber;

    assembly {
      bitNumber := and(tick, 0xFF)
      rowNumber := shr(8, tick)
    }
    uint256 word0 = bitmap[rowNumber];
    return (word0 & (1 << bitNumber)) > 0;
  }

  function toggleTick(int24 tick) external {
    tick = (tick / 60);
    tick = tick * 60;
    if (tick < -887272) tick = -887272;
    if (tick > 887272) tick = 887272;
    tick = (tick / 60);
    tick = tick * 60;

    assert(tick >= -887272);
    assert(tick <= 887272);
    bool before = isInitialized(tick);
    bool toggle = bitmap.toggleTick(tick);
    if (toggle) word = tickWordsTable.writeWord(tick, word);
    assert(isInitialized(tick) == !before);
  }

  function checkNextInitializedTickWithinOneWordInvariants(int24 tick) external view {
    tick = (tick / 60);
    tick = tick * 60;
    if (tick < -887272) tick = -887272;
    if (tick > 887272) tick = 887272;
    tick = (tick / 60);
    tick = tick * 60;

    int24 next = bitmap.getNextTick(tickWordsTable, word, tick);

    assert(next > tick);
    assert((next - tick) <= 2 * 887272);
    assert(next >= -887272);
    assert(next <= 887272);
    if (next != 887272) assert(isInitialized(next));
    // all the ticks between the input tick and the next tick should be uninitialized
    //for (int24 i = tick + 60; i < next; i += 60) {
    //  assert(!isInitialized(i));
    //}
  }
}
