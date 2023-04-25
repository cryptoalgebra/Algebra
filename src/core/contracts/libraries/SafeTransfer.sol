// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

import '../interfaces/IERC20Minimal.sol';

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
    (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20Minimal.transfer.selector, to, amount));
    require(success && (data.length == 0 || abi.decode(data, (bool))), 'TF');
  }
}
