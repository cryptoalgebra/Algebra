// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title Contract tracking liquidity position
/// @notice Using these methods farmingCenter receives information about changes in the positions
interface IPositionFollower {
    /// @notice Report an increase in liquidity
    /// @param tokenId The ID of the token for which liquidity is being added
    /// @param liquidityDelta The amount of added liquidity
    function increaseLiquidity(uint256 tokenId, uint256 liquidityDelta) external;

    /// @notice Report a decrease in liquidity
    /// @param tokenId The ID of the token for which liquidity is being subtracted
    /// @param liquidityDelta The amount of subtracted liquidity
    /// @return success Does the farming center agree with the change or not
    function decreaseLiquidity(uint256 tokenId, uint256 liquidityDelta) external returns (bool success);

    /// @notice Report a burn of position token
    /// @param tokenId The ID of the token which is being burned
    /// @return success Does the farming center agree with the change or not
    function burnPosition(uint256 tokenId) external returns (bool success);
}
