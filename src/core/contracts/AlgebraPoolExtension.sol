// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;
pragma abicoder v1;

import './base/AlgebraPoolBase.sol';
import './base/ReentrancyGuard.sol';
import './base/Positions.sol';
import './base/SwapCalculation.sol';
import './base/ReservesManager.sol';
import './base/TickStructure.sol';

import './libraries/FullMath.sol';
import './libraries/Constants.sol';
import './libraries/Plugins.sol';

import './interfaces/plugin/IAlgebraPlugin.sol';

/// @title Algebra pool extension for flash loans
/// @notice This contract contains the flash loan functionality separated from the main pool
/// @dev This contract is called via delegatecall from AlgebraPool
contract AlgebraPoolExtension is AlgebraPoolBase, TickStructure, ReentrancyGuard, Positions, SwapCalculation, ReservesManager {
  using Plugins for uint8;
  using Plugins for bytes4;

  /// @dev Override to prevent initialization since this contract is only used via delegatecall
  function _getDeployParameters() internal pure override returns (address, address, address, address, address) {
    return (address(0), address(0), address(0), address(0), address(0));
  }

  // ===== Stub implementations for IAlgebraPoolActions methods (not used in extension) =====

  function initialize(uint160) external pure override {
    revert('Not implemented in extension');
  }

  function mint(address, address, int24, int24, uint128, bytes calldata) external pure override returns (uint256, uint256, uint128) {
    revert('Not implemented in extension');
  }

  function burn(int24, int24, uint128, bytes calldata) external pure override returns (uint256, uint256) {
    revert('Not implemented in extension');
  }

  function collect(address, int24, int24, uint128, uint128) external pure override returns (uint128, uint128) {
    revert('Not implemented in extension');
  }

  function swap(address, bool, int256, uint160, bytes calldata) external pure override returns (int256, int256) {
    revert('Not implemented in extension');
  }

  function swapWithPaymentInAdvance(address, address, bool, int256, uint160, bytes calldata) external pure override returns (int256, int256) {
    revert('Not implemented in extension');
  }

  // ===== IAlgebraPoolPermissionedActions stubs =====

  function setCommunityFee(uint16) external pure override {
    revert('Not implemented in extension');
  }

  function setTickSpacing(int24) external pure override {
    revert('Not implemented in extension');
  }

  function setPlugin(address) external pure override {
    revert('Not implemented in extension');
  }

  function setPluginConfig(uint8) external pure override {
    revert('Not implemented in extension');
  }

  function setCommunityVault(address) external pure override {
    revert('Not implemented in extension');
  }

  function setFee(uint16) external pure override {
    revert('Not implemented in extension');
  }

  function sync() external pure override {
    revert('Not implemented in extension');
  }

  function skim() external pure override {
    revert('Not implemented in extension');
  }

  // ===== Flash loan implementation =====

  /// @notice Executes a flash loan
  /// @param recipient The address to receive the flash loaned tokens
  /// @param amount0 The amount of token0 to flash loan
  /// @param amount1 The amount of token1 to flash loan
  /// @param data Any data to be passed through to the callback
  function flash(address recipient, uint256 amount0, uint256 amount1, bytes calldata data) external override {
    if (globalState.pluginConfig.hasFlag(Plugins.BEFORE_FLASH_FLAG)) {
      IAlgebraPlugin(plugin).beforeFlash(msg.sender, recipient, amount0, amount1, data).shouldReturn(IAlgebraPlugin.beforeFlash.selector);
    }
    _lock();

    uint256 paid0;
    uint256 paid1;
    {
      (uint256 balance0Before, uint256 balance1Before) = _updateReserves();
      uint256 fee0;
      if (amount0 > 0) {
        fee0 = FullMath.mulDivRoundingUp(amount0, Constants.FLASH_FEE, Constants.FEE_DENOMINATOR);
        _transfer(token0, recipient, amount0);
      }
      uint256 fee1;
      if (amount1 > 0) {
        fee1 = FullMath.mulDivRoundingUp(amount1, Constants.FLASH_FEE, Constants.FEE_DENOMINATOR);
        _transfer(token1, recipient, amount1);
      }

      _flashCallback(fee0, fee1, data); // IAlgebraFlashCallback.algebraFlashCallback to msg.sender

      paid0 = _balanceToken0();
      if (balance0Before + fee0 > paid0) revert flashInsufficientPaid0();
      paid1 = _balanceToken1();
      if (balance1Before + fee1 > paid1) revert flashInsufficientPaid1();

      unchecked {
        paid0 -= balance0Before;
        paid1 -= balance1Before;
      }

      uint256 _communityFee = globalState.communityFee;
      if (_communityFee > 0) {
        uint256 communityFee0;
        if (paid0 > 0) communityFee0 = FullMath.mulDiv(paid0, _communityFee, Constants.COMMUNITY_FEE_DENOMINATOR);
        uint256 communityFee1;
        if (paid1 > 0) communityFee1 = FullMath.mulDiv(paid1, _communityFee, Constants.COMMUNITY_FEE_DENOMINATOR);

        _changeReserves(int256(communityFee0), int256(communityFee1), communityFee0, communityFee1, 0, 0);
      }
      emit Flash(msg.sender, recipient, amount0, amount1, paid0, paid1);
    }

    _unlock();
    if (globalState.pluginConfig.hasFlag(Plugins.AFTER_FLASH_FLAG)) {
      IAlgebraPlugin(plugin).afterFlash(msg.sender, recipient, amount0, amount1, paid0, paid1, data).shouldReturn(IAlgebraPlugin.afterFlash.selector);
    }
  }
}
