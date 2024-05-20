// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../libraries/TickMath.sol';

import '../interfaces/callback/IAlgebraSwapCallback.sol';

import '../interfaces/IAlgebraPool.sol';
import '../interfaces/IAlgebraFactory.sol';

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

    // try to reenter sync
    try IAlgebraPool(msg.sender).sync() {} catch (bytes memory reason) {
      require(bytes4(reason) == desiredSelector);
    }

    // try to reenter skim
    try IAlgebraPool(msg.sender).skim() {} catch (bytes memory reason) {
      require(bytes4(reason) == desiredSelector);
    }

    require(IAlgebraPool(msg.sender).isUnlocked() == false);

    require(false, 'Unable to reenter');
  }

  // factory reentrancy
  address public factory;
  address public tokenA;
  address public tokenB;

  function beforeCreatePoolHook(address, address, address, address, address, bytes calldata data) external returns (address plugin) {
    plugin = address(0);
    _createCustomPool(factory, tokenA, tokenB, data);
  }

  function createCustomPool(address _factory, address _tokenA, address _tokenB, bytes calldata data) external returns (address pool) {
    factory = _factory;
    tokenA = _tokenA;
    tokenB = _tokenB;
    pool = _createCustomPool(_factory, _tokenA, _tokenB, data);
  }

  function _createCustomPool(address _factory, address _tokenA, address _tokenB, bytes calldata data) internal returns (address pool) {
    pool = IAlgebraFactory(_factory).createCustomPool(address(this), msg.sender, _tokenA, _tokenB, data);
  }
}
