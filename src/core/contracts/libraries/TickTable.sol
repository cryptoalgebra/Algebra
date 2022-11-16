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
  /// @param leafs The mapping of words with ticks
  /// @param secondLayer The mapping of words with leafs
  /// @param tick The tick to toggle
  /// @param treeRoot The word with info about active subtrees
  function toggleTick(
    mapping(int16 => uint256) storage leafs,
    mapping(int16 => uint256) storage secondLayer,
    int24 tick,
    uint256 treeRoot
  ) internal returns (uint256 newTreeRoot) {
    newTreeRoot = treeRoot;
    (bool toggledNode, int16 nodeNumber) = _toggleTickInNode(leafs, tick);
    if (toggledNode) {
      (toggledNode, nodeNumber) = _toggleTickInNode(secondLayer, nodeNumber + MIN_ROW_ABS);
      if (toggledNode) {
        assembly {
          newTreeRoot := xor(newTreeRoot, shl(nodeNumber, 1))
        }
      }
    }
  }

  function _toggleTickInNode(mapping(int16 => uint256) storage row, int24 tick) private returns (bool toggledNode, int16 nodeNumber) {
    assembly {
      nodeNumber := sar(8, tick)
    }
    uint256 node = row[nodeNumber];
    assembly {
      toggledNode := iszero(node)
      node := xor(node, shl(and(tick, 0xFF), 1))
      toggledNode := xor(toggledNode, iszero(node))
    }
    row[nodeNumber] = node;
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

  function _getNextTickInSameNode(mapping(int16 => uint256) storage row, int24 tick)
    private
    view
    returns (
      int16 nodeNumber,
      int24 nextTick,
      bool initialized
    )
  {
    assembly {
      nodeNumber := sar(8, tick)
    }
    (nextTick, initialized) = nextTickInTheSameNode(row[nodeNumber], tick);
  }

  function _getFirstTickInNode(mapping(int16 => uint256) storage row, int24 nodeNumber) private view returns (int24 nextTick) {
    assembly {
      nextTick := shl(8, nodeNumber)
    }
    (nextTick, ) = nextTickInTheSameNode(row[int16(nodeNumber)], nextTick);
  }

  /// @notice Returns the next initialized tick in tree to the right (gte) of the given tick or `MAX_TICK`
  /// @param leafs The words with ticks
  /// @param secondLayer The words with info about active leafs
  /// @param treeRoot The word with info about active subtrees
  /// @param tick The starting tick
  /// @return nextTick The next initialized tick or `MAX_TICK`
  function getNextTick(
    mapping(int16 => uint256) storage leafs,
    mapping(int16 => uint256) storage secondLayer,
    uint256 treeRoot,
    int24 tick
  ) internal view returns (int24 nextTick) {
    tick++; // start at next tick since current doesn't matter
    int16 nodeNumber;
    bool initialized;

    // try to find initialized tick in the corresponding leaf of the tree
    (nodeNumber, nextTick, initialized) = _getNextTickInSameNode(leafs, tick);
    if (initialized) return nextTick;

    // try to find next initialized leaf in the tree
    (nodeNumber, nextTick, initialized) = _getNextTickInSameNode(secondLayer, nodeNumber + MIN_ROW_ABS + 1);
    if (!initialized) {
      // try to find which subtree has an active leaf
      (nextTick, initialized) = nextTickInTheSameNode(treeRoot, int24(++nodeNumber));
      if (!initialized) return TickMath.MAX_TICK;
      nextTick = _getFirstTickInNode(secondLayer, nextTick);
    }
    // try to find initialized tick in the corresponding leaf of the tree
    return _getFirstTickInNode(leafs, nextTick - MIN_ROW_ABS);
  }

  /// @notice Returns the next initialized tick contained in the same word as the tick that is
  /// to the right or at (gte) of the given tick
  /// @param word The word in which to compute the next initialized tick
  /// @param tick The starting tick
  /// @return nextTick The next initialized or uninitialized tick up to 256 ticks away from the current tick
  /// @return initialized Whether the next tick is initialized, as the function only searches within up to 256 ticks
  function nextTickInTheSameNode(uint256 word, int24 tick) private pure returns (int24 nextTick, bool initialized) {
    uint256 bitNumber;
    assembly {
      bitNumber := and(tick, 0xFF)
    }
    uint256 _row = word >> bitNumber; // all the 1s at or to the left of the bitNumber
    if (_row == 0) {
      nextTick = tick + int24(255 - bitNumber);
    } else {
      nextTick = tick + int24(getSingleSignificantBit(-_row & _row)); // least significant bit
      initialized = true;
    }
  }
}
