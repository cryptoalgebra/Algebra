// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../libraries/TransferHelper.sol';

contract TransferHelperTest {
    function safeTransfer(address token, address to, uint256 value) external {
        TransferHelper.safeTransfer(token, to, value);
    }

    function safeTransferFrom(address token, address from, address to, uint256 value) external {
        TransferHelper.safeTransferFrom(token, from, to, value);
    }

    function safeApprove(address token, address to, uint256 value) external {
        TransferHelper.safeApprove(token, to, value);
    }

    function safeTransferNative(address to, uint256 value) external payable {
        TransferHelper.safeTransferNative(to, value);
    }
}

/// @dev ERC20-shaped calls that either return no data or return false
contract TestERC20NonStandard {
    bool public returnsFalse;

    event Called(bytes4 selector);

    function setReturnsFalse(bool value) external {
        returnsFalse = value;
    }

    function transfer(address, uint256) external {
        _respond();
    }

    function transferFrom(address, address, uint256) external {
        _respond();
    }

    function approve(address, uint256) external {
        _respond();
    }

    function _respond() private {
        emit Called(msg.sig);
        if (returnsFalse) {
            assembly {
                mstore(0, 0)
                return(0, 32)
            }
        }
        assembly {
            return(0, 0)
        }
    }
}
