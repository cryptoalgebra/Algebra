// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import './Constants.sol';
import './TickMath.sol';

/// @title Packed tick initialized state library
/// @notice Stores a packed mapping of tick index to its initialized state and search tree
/// @dev The leafs mapping uses int16 for keys since ticks are represented as int24 and there are 256 (2^8) values per word.
library TickTree {
  int16 internal constant SECOND_LAYER_OFFSET = 3466; // ceil(MAX_TICK / 256)

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
      unchecked {
        (toggledNode, nodeNumber) = _toggleTickInNode(secondLayer, nodeNumber + SECOND_LAYER_OFFSET);
      }
      if (toggledNode) {
        assembly {
          newTreeRoot := xor(newTreeRoot, shl(nodeNumber, 1))
        }
      }
    }
  }

  /// @notice Calculates the required node and toggles tick in it
  /// @param row The level of tree
  /// @param tick The tick to toggle
  /// @return toggledNode Toggled whole node or not
  /// @return nodeNumber Number of corresponding node
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
    unchecked {
      tick++;
      int16 nodeNumber;
      bool initialized;
      assembly {
        // index in treeRoot
        nodeNumber := shr(8, add(sar(8, tick), SECOND_LAYER_OFFSET))
      }
      if (treeRoot & (1 << uint16(nodeNumber)) != 0) {
        // if subtree has active ticks
        // try to find initialized tick in the corresponding leaf of the tree
        (nodeNumber, nextTick, initialized) = _getNextActiveBitInSameNode(leafs, tick);
        if (initialized) return nextTick;

        // try to find next initialized leaf in the tree
        (nodeNumber, nextTick, initialized) = _getNextActiveBitInSameNode(secondLayer, nodeNumber + SECOND_LAYER_OFFSET + 1);
      }
      if (!initialized) {
        // try to find which subtree has an active leaf
        (nextTick, initialized) = _nextActiveBitInTheSameNode(treeRoot, ++nodeNumber);
        if (!initialized) return TickMath.MAX_TICK;
        nextTick = _getFirstActiveBitInNode(secondLayer, nextTick);
      }
      nextTick = _getFirstActiveBitInNode(leafs, nextTick - SECOND_LAYER_OFFSET);
    }
  }

  /// @notice Calculates node with given tick and returns next active tick
  /// @param row level of search tree
  /// @param tick The starting tick
  /// @return nodeNumber Number of corresponding node
  /// @return nextTick Number of next active tick or last tick in node
  /// @return initialized Is nextTick initialized or not
  function _getNextActiveBitInSameNode(
    mapping(int16 => uint256) storage row,
    int24 tick
  ) private view returns (int16 nodeNumber, int24 nextTick, bool initialized) {
    assembly {
      nodeNumber := sar(8, tick)
    }
    (nextTick, initialized) = _nextActiveBitInTheSameNode(row[nodeNumber], tick);
  }

  /// @notice Returns first active tick in given node
  /// @param row level of search tree
  /// @param nodeNumber Number of corresponding node
  /// @return nextTick Number of next active tick or last tick in node
  function _getFirstActiveBitInNode(mapping(int16 => uint256) storage row, int24 nodeNumber) private view returns (int24 nextTick) {
    assembly {
      nextTick := shl(8, nodeNumber)
    }
    (nextTick, ) = _nextActiveBitInTheSameNode(row[int16(nodeNumber)], nextTick);
  }

  /// @notice Returns the next initialized tick contained in the same word as the tick that is
  /// to the right or at (gte) of the given tick
  /// @param word The word in which to compute the next initialized tick
  /// @param tick The starting tick
  /// @return nextTick The next initialized or uninitialized tick up to 256 ticks away from the current tick
  /// @return initialized Whether the next tick is initialized, as the function only searches within up to 256 ticks
  function _nextActiveBitInTheSameNode(uint256 word, int24 tick) private pure returns (int24 nextTick, bool initialized) {
    uint256 bitNumber;
    assembly {
      bitNumber := and(tick, 0xFF)
    }
    unchecked {
      uint256 _row = word >> bitNumber; // all the 1s at or to the left of the bitNumber
      if (_row == 0) {
        nextTick = tick + int24(uint24(255 - bitNumber));
      } else {
        nextTick = tick + int24(uint24(getSingleSignificantBit((0 - _row) & _row))); // least significant bit
        initialized = true;
      }
    }
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
}
