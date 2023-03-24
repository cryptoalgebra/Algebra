// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

abstract contract Timestamp {
  /// @dev This function is created for testing by overriding it.
  /// @return A timestamp converted to uint32
  function _blockTimestamp() internal view virtual returns (uint32) {
    return uint32(block.timestamp); // truncation is desired
  }
}
