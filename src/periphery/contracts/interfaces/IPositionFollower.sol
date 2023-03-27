// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title
/// @notice
interface IPositionFollower {
    function increaseLiquidity(uint256 tokenId, uint256 liquidityDelta) external;

    function decreaseLiquidity(uint256 tokenId, uint256 liquidityDelta) external;

    function burnPosition(uint256 tokenId) external;
}
