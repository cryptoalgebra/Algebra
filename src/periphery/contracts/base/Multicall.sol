// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.20;

import '../interfaces/IMulticall.sol';

/// @title Multicall
/// @notice Enables calling multiple methods in a single call to the contract
abstract contract Multicall is IMulticall {
    /// @inheritdoc IMulticall
    function multicall(bytes[] calldata data) external payable override returns (bytes[] memory results) {
        results = new bytes[](data.length);
        unchecked {
            for (uint256 i = 0; i < data.length; i++) {
                (bool success, bytes memory result) = address(this).delegatecall(data[i]);
                if (!success) {
                    // Look for revert reason and bubble it up if present
                    require(result.length > 0);
                    // The easiest way to bubble the revert reason is using memory via assembly
                    assembly ('memory-safe') {
                        revert(add(32, result), mload(result))
                    }
                }
                results[i] = result;
            }
        }
    }
}
