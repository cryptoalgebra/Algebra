// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../libraries/TickMath.sol';

import '../interfaces/callback/IAlgebraSwapCallback.sol';

import '../interfaces/IAlgebraPool.sol';

contract TestAlgebraReentrantCallee is IAlgebraSwapCallback {
  string private constant expectedReason = 'LOK';

  function swapToReenter(address pool) external {
    IAlgebraPool(pool).swap(address(0), false, 1, TickMath.MAX_SQRT_RATIO - 1, new bytes(0));
  }

  function algebraSwapCallback(
    int256,
    int256,
    uint256,
    bytes calldata
  ) external override {
    // try to reenter swap
    try IAlgebraPool(msg.sender).swap(address(0), false, 1, 0, new bytes(0)) {} catch Error(string memory reason) {
      require(keccak256(abi.encode(reason)) == keccak256(abi.encode(expectedReason)));
    }

    // try to reenter swap supporting fee
    try IAlgebraPool(msg.sender).swapSupportingFeeOnInputTokens(address(0), address(0), false, 1, 0, new bytes(0)) {} catch Error(
      string memory reason
    ) {
      require(keccak256(abi.encode(reason)) == keccak256(abi.encode(expectedReason)));
    }

    // try to reenter mint
    try IAlgebraPool(msg.sender).mint(address(0), address(0), 0, 0, 0, new bytes(0)) {} catch Error(string memory reason) {
      require(keccak256(abi.encode(reason)) == keccak256(abi.encode(expectedReason)));
    }

    // try to reenter collect
    try IAlgebraPool(msg.sender).collect(address(0), 0, 0, 0, 0) {} catch Error(string memory reason) {
      require(keccak256(abi.encode(reason)) == keccak256(abi.encode(expectedReason)));
    }

    // try to reenter burn
    try IAlgebraPool(msg.sender).burn(0, 0, 0) {} catch Error(string memory reason) {
      require(keccak256(abi.encode(reason)) == keccak256(abi.encode(expectedReason)));
    }

    // try to reenter flash
    try IAlgebraPool(msg.sender).flash(address(0), 0, 0, new bytes(0)) {} catch Error(string memory reason) {
      require(keccak256(abi.encode(reason)) == keccak256(abi.encode(expectedReason)));
    }

    require(false, 'Unable to reenter');
  }
}
