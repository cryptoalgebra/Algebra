// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title
/// @notice
interface IPositionFollower {
    function increaseLiquidity(uint256 tokenId, uint256 liquidityDelta) external returns (bool success);

    function decreaseLiquidity(uint256 tokenId, uint256 liquidityDelta) external returns (bool success);

    function burnPosition(uint256 tokenId) external returns (bool success);
}
