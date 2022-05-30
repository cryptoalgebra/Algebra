// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.5.0;

/// @title Packed tick initialized state library
/// @notice Stores a packed mapping of tick index to its initialized state
/// @dev The mapping uses int16 for keys since ticks are represented as int24 and there are 256 (2^8) values per word.
library TickTable {
    /// @notice Computes the position in the mapping where the initialized bit for a tick lives
    /// @param tick The tick for which to compute the position
    /// @return rowNumber The key in the mapping containing the word in which the bit is stored
    /// @return bitNumber The bit position in the word where the flag is stored
    function position(int24 tick) private pure returns (int16 rowNumber, uint8 bitNumber) {
        assembly {
            bitNumber := and(tick, 0xFF)
            rowNumber := shr(8, tick)
        }
    }

    /// @notice Flips the initialized state for a given tick from false to true, or vice versa
    /// @param self The mapping in which to flip the tick
    /// @param tick The tick to flip
    function toggleTick(mapping(int16 => uint256) storage self, int24 tick) internal {
        require(tick % 60 == 0, 'tick is not spaced'); // ensure that the tick is spaced
        (int16 rowNumber, uint8 bitNumber) = position(tick / 60);
        self[rowNumber] ^= 1 << bitNumber;
    }
}
