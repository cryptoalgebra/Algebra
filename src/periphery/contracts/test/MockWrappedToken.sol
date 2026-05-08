// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '../interfaces/external/IWrappedToken.sol';

contract MockWrappedToken is ERC20, IWrappedToken {
    uint256 private constant UNDERLYING_PER_WRAPPED_TOKEN = 2;

    address public immutable underlyingToken;

    constructor(address _underlyingToken) ERC20('Mock Wrapped Token', 'MWT') {
        underlyingToken = _underlyingToken;
    }

    function wrap(uint256 underlyingTokenAmount) external returns (uint256 wrappedTokenAmount) {
        uint256 balanceBefore = IERC20(underlyingToken).balanceOf(address(this));

        IERC20(underlyingToken).transferFrom(msg.sender, address(this), underlyingTokenAmount);

        uint256 underlyingTokenReceived = IERC20(underlyingToken).balanceOf(address(this)) - balanceBefore;
        wrappedTokenAmount = underlyingTokenReceived / UNDERLYING_PER_WRAPPED_TOKEN;
        _mint(msg.sender, wrappedTokenAmount);

        return wrappedTokenAmount;
    }

    function unwrap(uint256 wrappedTokenAmount) external returns (uint256 underlyingTokenAmount) {
        underlyingTokenAmount = wrappedTokenAmount * UNDERLYING_PER_WRAPPED_TOKEN;

        _burn(msg.sender, wrappedTokenAmount);
        IERC20(underlyingToken).transfer(msg.sender, underlyingTokenAmount);

        return underlyingTokenAmount;
    }
}
