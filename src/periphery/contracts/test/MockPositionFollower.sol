// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../interfaces/IPositionFollower.sol';
import '../interfaces/INonfungiblePositionManager.sol';

contract MockDummyContract {
    uint256 junk;

    function write(uint256 value) external {
        junk = value;
    }
}

contract MockPositionFollower is IPositionFollower {
    enum Failure {
        None,
        ArithmeticPanic,
        Assert,
        WithMessage,
        WithoutMessage,
        WithCustomError,
        OutOfGas
    }

    error someCustomError();

    mapping(uint256 tokenId => Failure fail) private failForToken;

    bool public wasCalled;

    MockDummyContract _dummy;

    constructor() {
        _dummy = new MockDummyContract();
    }

    function setFailForToken(uint256 tokenId, Failure value) external {
        failForToken[tokenId] = value;
    }

    function enterToFarming(address posManager, uint256 tokenId) external {
        INonfungiblePositionManager(posManager).switchFarmingStatus(tokenId, true);
    }

    function exitFromFarming(address posManager, uint256 tokenId) external {
        INonfungiblePositionManager(posManager).switchFarmingStatus(tokenId, false);
    }

    function applyLiquidityDelta(uint256 tokenId, int256) external override {
        Failure failureMode = failForToken[tokenId];
        wasCalled = true;

        if (failureMode == Failure.None) return;

        if (failureMode == Failure.ArithmeticPanic) {
            uint256 zero;
            zero = 100 / zero;
        }

        if (failureMode == Failure.Assert) {
            assert(false);
        }

        if (failureMode == Failure.WithMessage) {
            revert('Error with message');
        }

        if (failureMode == Failure.WithoutMessage) {
            revert();
        }

        if (failureMode == Failure.WithCustomError) {
            revert someCustomError();
        }

        if (failureMode == Failure.OutOfGas) {
            _dummy.write{gas: 5000}(100);
        }
    }
}
