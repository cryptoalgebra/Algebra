// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../interfaces/plugin/IAlgebraPlugin.sol';
import '../interfaces/plugin/IAlgebraDynamicFeePlugin.sol';
import '../libraries/FullMath.sol';

/// @dev Plugin for amount delta tests. Each delta is an absolute amount or a share of its base, plus an addend
/// to step over the bounds. It also records what the hooks observed, so tests can check the swap math amounts
contract MockDeltaPlugin is IAlgebraPlugin, IAlgebraDynamicFeePlugin {
  uint256 internal constant SHARE_DENOMINATOR = 1e6;

  struct Delta {
    uint256 value; // absolute amount, or a share of the base in 1e-6 if `isShare`
    bool isShare;
    uint256 addend;
  }

  Delta public inDecrease; // base: |amountRequired|
  Delta public inIncrease; // base: the input calculated by the swap math
  Delta public outDecrease; // base: the output calculated by the swap math
  uint24 public overrideFee;

  int256 public seenAmountRequired;
  bool public seenWithPaymentInAdvance;
  int256 public seenCalc0;
  int256 public seenCalc1;
  int256 public seenAfterSwap0;
  int256 public seenAfterSwap1;
  uint256 public seenTotalSwapFeeAmount;
  uint256 public afterSwapCalculationCalls;

  function setInDecrease(uint256 value, bool isShare, uint256 addend) external {
    inDecrease = Delta(value, isShare, addend);
  }

  function setInIncrease(uint256 value, bool isShare, uint256 addend) external {
    inIncrease = Delta(value, isShare, addend);
  }

  function setOutDecrease(uint256 value, bool isShare, uint256 addend) external {
    outDecrease = Delta(value, isShare, addend);
  }

  function setOverrideFee(uint24 newOverrideFee) external {
    overrideFee = newOverrideFee;
  }

  function _apply(Delta memory delta, uint256 base) internal pure returns (uint256) {
    return (delta.isShare ? FullMath.mulDiv(base, delta.value, SHARE_DENOMINATOR) : delta.value) + delta.addend;
  }

  function defaultPluginConfig() external pure override returns (uint16) {
    return 0;
  }

  function getCurrentFee() external pure override returns (uint16) {
    return 500;
  }

  function beforeSwap(
    address,
    address,
    bool,
    int256 amountRequired,
    uint160,
    bool withPaymentInAdvance,
    bytes calldata
  ) external override returns (uint256 amountInDecrease, bytes4, uint24) {
    (seenAmountRequired, seenWithPaymentInAdvance) = (amountRequired, withPaymentInAdvance);
    amountInDecrease = _apply(inDecrease, amountRequired > 0 ? uint256(amountRequired) : uint256(-amountRequired));
    return (amountInDecrease, IAlgebraPlugin.beforeSwap.selector, overrideFee);
  }

  function afterSwapCalculation(
    address,
    address,
    bool zeroToOne,
    int256,
    uint160,
    int256 amount0,
    int256 amount1,
    bytes calldata
  ) external override returns (bytes4, uint256 amountInIncrease, uint256 amountOutDecrease) {
    afterSwapCalculationCalls++;
    (seenCalc0, seenCalc1) = (amount0, amount1);
    (int256 amountIn, int256 amountOut) = zeroToOne ? (amount0, amount1) : (amount1, amount0);
    amountInIncrease = _apply(inIncrease, amountIn > 0 ? uint256(amountIn) : 0);
    amountOutDecrease = _apply(outDecrease, amountOut < 0 ? uint256(-amountOut) : 0);
    return (IAlgebraPlugin.afterSwapCalculation.selector, amountInIncrease, amountOutDecrease);
  }

  function afterSwap(
    address,
    address,
    bool,
    int256,
    uint160,
    int256 amount0,
    int256 amount1,
    uint256 totalSwapFeeAmount,
    bytes calldata
  ) external override returns (bytes4) {
    (seenAfterSwap0, seenAfterSwap1, seenTotalSwapFeeAmount) = (amount0, amount1, totalSwapFeeAmount);
    return IAlgebraPlugin.afterSwap.selector;
  }

  function beforeInitialize(address, uint160) external pure override returns (bytes4) {
    return IAlgebraPlugin.beforeInitialize.selector;
  }

  function afterInitialize(address, uint160, int24) external pure override returns (bytes4) {
    return IAlgebraPlugin.afterInitialize.selector;
  }

  function beforeModifyPosition(address, address, int24, int24, int128, bytes calldata) external pure override returns (bytes4) {
    return IAlgebraPlugin.beforeModifyPosition.selector;
  }

  function afterModifyPosition(address, address, int24, int24, int128, uint256, uint256, bytes calldata) external pure override returns (bytes4) {
    return IAlgebraPlugin.afterModifyPosition.selector;
  }

  function beforeFlash(address, address, uint256, uint256, bytes calldata) external pure override returns (bytes4) {
    return IAlgebraPlugin.beforeFlash.selector;
  }

  function afterFlash(address, address, uint256, uint256, uint256, uint256, bytes calldata) external pure override returns (bytes4) {
    return IAlgebraPlugin.afterFlash.selector;
  }

  function afterCross(bool, uint256, uint256, int24, int128) external pure override returns (bytes4) {
    return IAlgebraPlugin.afterCross.selector;
  }
}
