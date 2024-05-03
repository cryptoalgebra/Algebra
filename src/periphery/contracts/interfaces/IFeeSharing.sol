// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.20;

interface IFeeSharing {
    function assign(uint256 _tokenId) external returns (uint256);
}
