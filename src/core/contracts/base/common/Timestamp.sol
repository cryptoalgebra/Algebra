// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

/// @title Abstract contract with modified blockTimestamp functionality
/// @notice Allows the pool and other contracts to get a timestamp truncated to 32 bits
/// @dev Can be overridden in tests to make testing easier
abstract contract Timestamp {
  /// @dev This function is created for testing by overriding it.
  /// @return A timestamp converted to uint32
  function _blockTimestamp() internal view virtual returns (uint32) {
    return uint32(block.timestamp); // truncation is desired
  }
}
