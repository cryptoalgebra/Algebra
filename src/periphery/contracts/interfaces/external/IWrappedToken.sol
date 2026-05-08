// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.7.5;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

/// @title Interface for a token with an ERC20 underlying/wrapped conversion
interface IWrappedToken is IERC20 {
    /// @notice Wraps underlying tokens into wrapped tokens
    /// @param underlyingTokenAmount The amount of underlying tokens to wrap
    /// @return wrappedTokenAmount The amount of wrapped tokens received
    function wrap(uint256 underlyingTokenAmount) external returns (uint256 wrappedTokenAmount);

    /// @notice Unwraps wrapped tokens into underlying tokens
    /// @param wrappedTokenAmount The amount of wrapped tokens to unwrap
    /// @return underlyingTokenAmount The amount of underlying tokens received
    function unwrap(uint256 wrappedTokenAmount) external returns (uint256 underlyingTokenAmount);
}
