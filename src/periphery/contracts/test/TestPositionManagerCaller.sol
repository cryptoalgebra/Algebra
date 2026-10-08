// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '../interfaces/INonfungiblePositionManager.sol';

/// @dev Forwards position manager calls, so that there msg.sender is this contract and tx.origin is its caller
contract TestPositionManagerCaller {
    INonfungiblePositionManager private immutable nonfungiblePositionManager;

    constructor(INonfungiblePositionManager _nonfungiblePositionManager) {
        nonfungiblePositionManager = _nonfungiblePositionManager;
    }

    function approve(address token) external {
        IERC20(token).approve(address(nonfungiblePositionManager), type(uint256).max);
    }

    function mint(INonfungiblePositionManager.MintParams calldata params) external {
        nonfungiblePositionManager.mint(params);
    }

    function increaseLiquidity(INonfungiblePositionManager.IncreaseLiquidityParams calldata params) external {
        nonfungiblePositionManager.increaseLiquidity(params);
    }

    function decreaseLiquidity(INonfungiblePositionManager.DecreaseLiquidityParams calldata params) external {
        nonfungiblePositionManager.decreaseLiquidity(params);
    }
}
