// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../interfaces/pool/IAlgebraPoolErrors.sol';

/// @title SafeTransfer
/// @notice Safe ERC20 transfer library that gracefully handles missing return values.
/// @dev Credit to Solmate under MIT license: https://github.com/transmissions11/solmate/blob/ed67feda67b24fdeff8ad1032360f0ee6047ba0a/src/utils/SafeTransferLib.sol
/// @dev Please note that this library does not check if the token has a code! That responsibility is delegated to the caller.
library SafeTransfer {
  /// @notice Transfers tokens to a recipient
  /// @dev Calls transfer on token contract, errors with transferFailed() if transfer fails
  /// @param token The contract address of the token which will be transferred
  /// @param to The recipient of the transfer
  /// @param amount The amount of the token to transfer
  function safeTransfer(address token, address to, uint256 amount) internal {
    bool success;
    assembly {
      let freeMemoryPointer := mload(0x40) // we will need to restore 0x40 slot
      mstore(0x00, 0xa9059cbb00000000000000000000000000000000000000000000000000000000) // "transfer(address,uint256)" selector
      mstore(0x04, and(to, 0xffffffffffffffffffffffffffffffffffffffff)) // append cleaned "to" address
      mstore(0x24, amount)
      // now we use 0x00 - 0x44 bytes (68), freeMemoryPointer is dirty
      success := call(gas(), token, 0, 0, 0x44, 0, 0x20)
      success := and(
        // set success to true if call isn't reverted and returned exactly 1 (can't just be non-zero data) or nothing
        or(and(eq(mload(0), 1), eq(returndatasize(), 32)), iszero(returndatasize())),
        success
      )
      mstore(0x40, freeMemoryPointer) // restore the freeMemoryPointer
    }

    if (!success) revert IAlgebraPoolErrors.transferFailed();
  }
}
