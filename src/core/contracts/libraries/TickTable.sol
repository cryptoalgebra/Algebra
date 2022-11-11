// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

import './Constants.sol';
import './TickMath.sol';

/// @title Packed tick initialized state library
/// @notice Stores a packed mapping of tick index to its initialized state
/// @dev The mapping uses int16 for keys since ticks are represented as int24 and there are 256 (2^8) values per word.
library TickTable {
  int16 internal constant MIN_ROW_ABS = 3466;

  /// @notice Toggles the initialized state for a given tick from false to true, or vice versa
  /// @param self The mapping in which to toggle the tick
  /// @param tick The tick to toggle
  function toggleTick(mapping(int16 => uint256) storage self, int24 tick) internal returns (bool toggle) {
    require(tick % Constants.TICK_SPACING == 0, 'tick is not spaced'); // ensure that the tick is spaced
    int16 rowNumber;
    uint8 bitNumber;

    assembly {
      bitNumber := and(tick, 0xFF)
      rowNumber := sar(8, tick)
    }
    uint256 wordBefore = self[rowNumber];
    self[rowNumber] ^= 1 << bitNumber;
    if ((self[rowNumber] == 0) != (wordBefore == 0)) return true;
  }

  /// @notice get position of single 1-bit
  /// @dev it is assumed that word contains exactly one 1-bit, otherwise the result will be incorrect
  /// @param word The word containing only one 1-bit
  function getSingleSignificantBit(uint256 word) internal pure returns (uint8 singleBitPos) {
    assembly {
      singleBitPos := iszero(and(word, 0x5555555555555555555555555555555555555555555555555555555555555555))
      singleBitPos := or(singleBitPos, shl(7, iszero(and(word, 0x00000000000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF))))
      singleBitPos := or(singleBitPos, shl(6, iszero(and(word, 0x0000000000000000FFFFFFFFFFFFFFFF0000000000000000FFFFFFFFFFFFFFFF))))
      singleBitPos := or(singleBitPos, shl(5, iszero(and(word, 0x00000000FFFFFFFF00000000FFFFFFFF00000000FFFFFFFF00000000FFFFFFFF))))
      singleBitPos := or(singleBitPos, shl(4, iszero(and(word, 0x0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF0000FFFF))))
      singleBitPos := or(singleBitPos, shl(3, iszero(and(word, 0x00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF))))
      singleBitPos := or(singleBitPos, shl(2, iszero(and(word, 0x0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F))))
      singleBitPos := or(singleBitPos, shl(1, iszero(and(word, 0x3333333333333333333333333333333333333333333333333333333333333333))))
    }
  }

  /// @notice get position of most significant 1-bit (leftmost)
  /// @dev it is assumed that before the call, a check will be made that the argument (word) is not equal to zero
  /// @param word The word containing at least one 1-bit
  function getMostSignificantBit(uint256 word) internal pure returns (uint8 mostBitPos) {
    assembly {
      word := or(word, shr(1, word))
      word := or(word, shr(2, word))
      word := or(word, shr(4, word))
      word := or(word, shr(8, word))
      word := or(word, shr(16, word))
      word := or(word, shr(32, word))
      word := or(word, shr(64, word))
      word := or(word, shr(128, word))
      word := sub(word, shr(1, word))
    }
    return (getSingleSignificantBit(word));
  }

  function writeWord(
    mapping(int16 => uint256) storage self,
    int24 tick,
    uint256 word
  ) internal returns (uint256 res) {
    require(tick % Constants.TICK_SPACING == 0, 'tick is not spaced'); // ensure that the tick is spaced
    int16 rowNumber;
    uint8 bitNumber;
    res = word;
    assembly {
      rowNumber := sar(8, tick)
    }

    int16 movedRowNumber = rowNumber + MIN_ROW_ABS;

    assembly {
      bitNumber := and(movedRowNumber, 0xFF)
      rowNumber := sar(8, movedRowNumber)
    }
    uint256 wordBefore = self[rowNumber];
    self[rowNumber] ^= 1 << bitNumber;
    if ((self[rowNumber] == 0) != (wordBefore == 0)) {
      uint8 wordBitNumber;
      assembly {
        wordBitNumber := and(rowNumber, 0xFF)
      }
      res ^= 1 << wordBitNumber;
    }
  }

  function getNextTick(
    mapping(int16 => uint256) storage self,
    mapping(int16 => uint256) storage wordTicks,
    uint256 word,
    int24 tick
  ) internal view returns (int24 nextTick) {
    bool initialized;
    int16 rowNumber;

    assembly {
      rowNumber := sar(8, tick)
    }
    (nextTick, initialized) = nextTickInTheSameRow(self[rowNumber], tick);
    if (!initialized) {
      int16 movedRowNumber = rowNumber + MIN_ROW_ABS;

      assembly {
        rowNumber := sar(8, movedRowNumber)
      }
      (nextTick, initialized) = nextTickInTheSameRow(wordTicks[rowNumber], movedRowNumber);

      if (!initialized) {
        uint8 wordBitNumber;
        assembly {
          wordBitNumber := and(rowNumber, 0xFF)
        }
        (nextTick, initialized) = nextTickInTheSameRow(word, wordBitNumber);
        if (!initialized) return TickMath.MAX_TICK;
        else {
          rowNumber = int16(nextTick);
          assembly {
            nextTick := shl(8, nextTick)
          }
          (nextTick, ) = nextTickInTheSameRow(wordTicks[rowNumber], nextTick - 1);
          nextTick -= MIN_ROW_ABS;
          rowNumber = int16(nextTick);
          assembly {
            nextTick := shl(8, nextTick)
          }
          (nextTick, ) = nextTickInTheSameRow(self[rowNumber], nextTick - 1);
        }
      } else {
        nextTick -= MIN_ROW_ABS;
        rowNumber = int16(nextTick);
        assembly {
          nextTick := shl(8, nextTick)
        }
        (nextTick, ) = nextTickInTheSameRow(self[rowNumber], nextTick - 1);
      }
    }
  }

  /// @notice Returns the next initialized tick contained in the same word (or adjacent word) as the tick that is either
  /// to the left (less than or equal to) or right (greater than) of the given tick
  /// @param word The mapping in which to compute the next initialized tick
  /// @param tick The starting tick
  /// @return nextTick The next initialized or uninitialized tick up to 256 ticks away from the current tick
  /// @return initialized Whether the next tick is initialized, as the function only searches within up to 256 ticks
  function nextTickInTheSameRow(uint256 word, int24 tick) private view returns (int24 nextTick, bool initialized) {
    // start from the word of the next tick, since the current tick state doesn't matter
    tick += 1;
    uint8 bitNumber;
    assembly {
      bitNumber := and(tick, 0xFF)
    }

    // all the 1s at or to the left of the bitNumber
    uint256 _row = word >> (bitNumber);

    if (_row != 0) {
      tick += int24(getSingleSignificantBit(-_row & _row)); // least significant bit
      return (tick, true);
    } else {
      tick += int24(255 - bitNumber);
      return (tick, false);
    }
  }
}
