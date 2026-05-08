// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;
pragma abicoder v2;

import '../SwapRouter.sol';

contract MockTimeSwapRouter is SwapRouter {
    uint256 time;

    constructor(
        address _factory,
        address _WNativeToken,
        address _poolDeployer
    ) SwapRouter(_factory, _WNativeToken, _poolDeployer, address(0), address(0)) {}

    function _blockTimestamp() internal view override returns (uint256) {
        return time;
    }

    function setTime(uint256 _time) external {
        time = _time;
    }
}

contract MockTimeSwapRouterWithWrappedToken is SwapRouter {
    uint256 time;

    constructor(
        address _factory,
        address _WNativeToken,
        address _poolDeployer,
        address _underlyingToken,
        address _wrappedToken
    ) SwapRouter(_factory, _WNativeToken, _poolDeployer, _underlyingToken, _wrappedToken) {}

    function _blockTimestamp() internal view override returns (uint256) {
        return time;
    }

    function setTime(uint256 _time) external {
        time = _time;
    }
}
