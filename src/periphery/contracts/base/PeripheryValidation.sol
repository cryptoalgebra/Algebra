// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.17;

import './BlockTimestamp.sol';

/// @dev Credit to Uniswap Labs under GPL-2.0-or-later license:
/// https://github.com/Uniswap/v3-periphery
abstract contract PeripheryValidation is BlockTimestamp {
    modifier checkDeadline(uint256 deadline) {
        _checkDeadline(deadline);
        _;
    }

    function _checkDeadline(uint256 deadline) private view {
        require(_blockTimestamp() <= deadline, 'Transaction too old');
    }
}
