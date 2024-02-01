// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../libraries/TickMath.sol';

import '../interfaces/callback/IAlgebraSwapCallback.sol';

import '../interfaces/IAlgebraPool.sol';

contract TestAlgebraReentrantCallee is IAlgebraSwapCallback {
  bytes4 private constant desiredSelector = bytes4(keccak256(bytes('locked()')));

  function swapToReenter(address pool) external {
    unchecked {
      IAlgebraPool(pool).swap(address(0), false, 1, TickMath.MAX_SQRT_RATIO - 1, new bytes(0));
    }
  }

  function algebraSwapCallback(int256, int256, bytes calldata) external override {
    int24 tickSpacing = IAlgebraPool(msg.sender).tickSpacing();

    // try to reenter swap
    try IAlgebraPool(msg.sender).swap(address(0), false, 1, 0, new bytes(0)) {} catch (bytes memory reason) {
      require(bytes4(reason) == desiredSelector);
    }

    // try to reenter swap supporting fee
    try IAlgebraPool(msg.sender).swapWithPaymentInAdvance(address(0), address(0), false, 1, 0, new bytes(0)) {} catch (bytes memory reason) {
      require(bytes4(reason) == desiredSelector);
    }

    // try to reenter mint
    try IAlgebraPool(msg.sender).mint(address(0), address(0), 0, tickSpacing, 100, new bytes(0)) {} catch (bytes memory reason) {
      require(bytes4(reason) == desiredSelector);
    }

    // try to reenter collect
    try IAlgebraPool(msg.sender).collect(address(0), 0, 0, 0, 0) {} catch (bytes memory reason) {
      require(bytes4(reason) == desiredSelector);
    }

    // try to reenter burn
    try IAlgebraPool(msg.sender).burn(0, tickSpacing, 0, new bytes(0)) {} catch (bytes memory reason) {
      require(bytes4(reason) == desiredSelector);
    }

    // try to reenter flash
    try IAlgebraPool(msg.sender).flash(address(0), 0, 0, new bytes(0)) {} catch (bytes memory reason) {
      require(bytes4(reason) == desiredSelector);
    }

    // try to reenter setCommunityFee
    try IAlgebraPool(msg.sender).setCommunityFee(10) {} catch (bytes memory reason) {
      require(bytes4(reason) == desiredSelector);
    }

    // try to reenter setTickSpacing
    try IAlgebraPool(msg.sender).setTickSpacing(20) {} catch (bytes memory reason) {
      require(bytes4(reason) == desiredSelector);
    }

    // try to reenter setPlugin
    try IAlgebraPool(msg.sender).setPlugin(address(this)) {} catch (bytes memory reason) {
      require(bytes4(reason) == desiredSelector);
    }

    // try to reenter setPluginConfig
    try IAlgebraPool(msg.sender).setPluginConfig(1) {} catch (bytes memory reason) {
      require(bytes4(reason) == desiredSelector);
    }

    // try to reenter setFee
    try IAlgebraPool(msg.sender).setFee(120) {} catch (bytes memory reason) {
      require(bytes4(reason) == desiredSelector);
    }

    // try to reenter setCommunityFeeVault
    try IAlgebraPool(msg.sender).setCommunityVault(address(this)) {} catch (bytes memory reason) {
      require(bytes4(reason) == desiredSelector);
    }

    // try to get AMM state
    try IAlgebraPool(msg.sender).safelyGetStateOfAMM() {} catch (bytes memory reason) {
      require(bytes4(reason) == desiredSelector);
    }

    require(IAlgebraPool(msg.sender).isUnlocked() == false);

    require(false, 'Unable to reenter');
  }
}
