// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

import './Constants.sol';
import './TickMath.sol';

/// @title Packed tick initialized state library
/// @notice Stores a packed mapping of tick index to its initialized state
/// @dev The mapping uses int16 for keys since ticks are represented as int24 and there are 256 (2^8) values per word.
library TickTable {
  /// @notice Toggles the initialized state for a given tick from false to true, or vice versa
  /// @param self The mapping in which to toggle the tick
  /// @param tick The tick to toggle
  function toggleTick(mapping(int16 => uint256) storage self, int24 tick) internal {
    require(tick % Constants.TICK_SPACING == 0, 'tick is not spaced'); // ensure that the tick is spaced
    tick /= Constants.TICK_SPACING; // compress tick
    int16 rowNumber;
    uint8 bitNumber;

    assembly {
      bitNumber := and(tick, 0xFF)
      rowNumber := shr(8, tick)
    }
    self[rowNumber] ^= 1 << bitNumber;
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

  /// @notice Returns the next initialized tick contained in the same word (or adjacent word) as the tick that is either
  /// to the left (less than or equal to) or right (greater than) of the given tick
  /// @param self The mapping in which to compute the next initialized tick
  /// @param tick The starting tick
  /// @param lte Whether to search for the next initialized tick to the left (less than or equal to the starting tick)
  /// @return nextTick The next initialized or uninitialized tick up to 256 ticks away from the current tick
  /// @return initialized Whether the next tick is initialized, as the function only searches within up to 256 ticks
  function nextTickInTheSameRow(
    mapping(int16 => uint256) storage self,
    int24 tick,
    bool lte
  ) internal view returns (int24 nextTick, bool initialized) {
    {
      int24 tickSpacing = Constants.TICK_SPACING;
      // compress and round towards negative infinity if negative
      assembly {
        tick := sub(sdiv(tick, tickSpacing), and(slt(tick, 0), not(iszero(smod(tick, tickSpacing)))))
      }
    }

    if (lte) {
      // unpacking not made into a separate function for gas and contract size savings
      int16 rowNumber;
      uint8 bitNumber;
      assembly {
        bitNumber := and(tick, 0xFF)
        rowNumber := shr(8, tick)
      }
      uint256 _row = self[rowNumber] << (255 - bitNumber); // all the 1s at or to the right of the current bitNumber

      if (_row != 0) {
        tick -= int24(255 - getMostSignificantBit(_row));
        return (uncompressAndBoundTick(tick), true);
      } else {
        tick -= int24(bitNumber);
        return (uncompressAndBoundTick(tick), false);
      }
    } else {
      // start from the word of the next tick, since the current tick state doesn't matter
      tick += 1;
      int16 rowNumber;
      uint8 bitNumber;
      assembly {
        bitNumber := and(tick, 0xFF)
        rowNumber := shr(8, tick)
      }

      // all the 1s at or to the left of the bitNumber
      uint256 _row = self[rowNumber] >> (bitNumber);

      if (_row != 0) {
        tick += int24(getSingleSignificantBit(-_row & _row)); // least significant bit
        return (uncompressAndBoundTick(tick), true);
      } else {
        tick += int24(255 - bitNumber);
        return (uncompressAndBoundTick(tick), false);
      }
    }
  }

  function uncompressAndBoundTick(int24 tick) private pure returns (int24 boundedTick) {
    boundedTick = tick * Constants.TICK_SPACING;
    if (boundedTick < TickMath.MIN_TICK) {
      boundedTick = TickMath.MIN_TICK;
    } else if (boundedTick > TickMath.MAX_TICK) {
      boundedTick = TickMath.MAX_TICK;
    }
  }
}
