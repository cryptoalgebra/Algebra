// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../libraries/SafeERC20Namer.sol';

contract SafeERC20NamerTest {
    function tokenSymbol(address token) external view returns (string memory) {
        return SafeERC20Namer.tokenSymbol(token);
    }
}

/// @dev Token whose symbol is bytes32, like MKR
contract TestBytes32Symbol {
    bytes32 public constant symbol = 'B32';
}

/// @dev Token without a symbol function
contract TestNoSymbol {}
