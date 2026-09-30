// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;
pragma abicoder v1;

import '../interfaces/plugin/IAlgebraPlugin.sol';
import '../interfaces/plugin/IAlgebraDynamicFeePlugin.sol';
import '../interfaces/IAlgebraPool.sol';
import '../libraries/Plugins.sol';
import './TestERC20.sol';

contract MockPoolPlugin is IAlgebraPlugin, IAlgebraDynamicFeePlugin {
  address public pool;
  uint16 public selectorsDisableConfig;
  uint24 public overrideFee;
  bool public isDisabled;

  uint256 public amountInDecrease;
  uint256 public amountInIncrease;
  uint256 public amountOutDecrease;

  constructor(address _pool) {
    pool = _pool;
  }

  event BeforeInitialize(address sender, uint160 sqrtPriceX96);
  event AfterInitialize(address sender, uint160 sqrtPriceX96, int24 tick);
  event BeforeModifyPosition(address sender, address recipient, int24 bottomTick, int24 topTick, int128 desiredLiquidityDelta, bytes data);
  event AfterModifyPosition(
    address sender,
    address recipient,
    int24 bottomTick,
    int24 topTick,
    int128 desiredLiquidityDelta,
    uint256 amount0,
    uint256 amount1,
    bytes data
  );
  event BeforeSwap(
    address sender,
    address recipient,
    bool zeroToOne,
    int256 amountRequired,
    uint160 limitSqrtPrice,
    bool withPaymentInAdvance,
    bytes data
  );
  event AfterSwapCalculation(
    address sender,
    address recipient,
    bool zeroToOne,
    int256 amountRequired,
    uint160 limitSqrtPrice,
    int256 amount0,
    int256 amount1,
    bytes data
  );
  event AfterSwap(
    address sender,
    address recipient,
    bool zeroToOne,
    int256 amountRequired,
    uint160 limitSqrtPrice,
    int256 amount0,
    int256 amount1,
    bytes data
  );
  event BeforeFlash(address sender, address recipient, uint256 amount0, uint256 amount1, bytes data);
  event AfterFlash(address sender, address recipient, uint256 amount0, uint256 amount1, uint256 paid0, uint256 paid1, bytes data);
  event AfterCross(bool zeroToOne, uint256 swapStepAmount, uint256 feeStepAmount, int24 tick, int128 liquidityDelta);

  function defaultPluginConfig() external view override returns (uint16) {}

  function getCurrentFee() external pure override returns (uint16 fee) {
    return 220;
  }

  function setSelectorDisable(uint16 newSelectorsDisableConfig) external {
    selectorsDisableConfig = newSelectorsDisableConfig;
  }

  function setAmountInDecrease(uint256 newAmountInDecrease) external {
    amountInDecrease = newAmountInDecrease;
  }

  function setAmountInIncrease(uint256 newAmountInIncrease) external {
    amountInIncrease = newAmountInIncrease;
  }

  function setAmountOutDecrease(uint256 newAmountOutDecrease) external {
    amountOutDecrease = newAmountOutDecrease;
  }

  function setOverrideFee(uint24 _overrideFee) external {
    overrideFee = _overrideFee;
  }

  /// @notice The hook called before the state of a pool is initialized
  /// @param sender The initial msg.sender for the initialize call
  /// @param sqrtPriceX96 The sqrt(price) of the pool as a Q64.96
  /// @return bytes4 The function selector for the hook
  function beforeInitialize(address sender, uint160 sqrtPriceX96) external override returns (bytes4) {
    emit BeforeInitialize(sender, sqrtPriceX96);
    if (!Plugins.hasFlag(selectorsDisableConfig, Plugins.DYNAMIC_FEE)) return IAlgebraPlugin.beforeInitialize.selector;
    return IAlgebraPlugin.defaultPluginConfig.selector;
  }

  /// @notice The hook called after the state of a pool is initialized
  /// @param sender The initial msg.sender for the initialize call
  /// @param sqrtPriceX96 The sqrt(price) of the pool as a Q64.96
  /// @param tick The current tick after the state of a pool is initialized
  /// @return bytes4 The function selector for the hook
  function afterInitialize(address sender, uint160 sqrtPriceX96, int24 tick) external override returns (bytes4) {
    emit AfterInitialize(sender, sqrtPriceX96, tick);
    if (!Plugins.hasFlag(selectorsDisableConfig, Plugins.AFTER_INIT_FLAG)) return IAlgebraPlugin.afterInitialize.selector;
    return IAlgebraPlugin.defaultPluginConfig.selector;
  }

  /// @notice The hook called before a position is modified
  /// @param sender The initial msg.sender for the modify position call
  /// @return bytes4 The function selector for the hook
  function beforeModifyPosition(
    address sender,
    address recipient,
    int24 bottomTick,
    int24 topTick,
    int128 desiredLiquidityDelta,
    bytes calldata data
  ) external override returns (bytes4) {
    emit BeforeModifyPosition(sender, recipient, bottomTick, topTick, desiredLiquidityDelta, data);
    if (!Plugins.hasFlag(selectorsDisableConfig, Plugins.BEFORE_POSITION_MODIFY_FLAG))
      return IAlgebraPlugin.beforeModifyPosition.selector;
    return IAlgebraPlugin.defaultPluginConfig.selector;
  }

  /// @notice The hook called after a position is modified
  /// @param sender The initial msg.sender for the modify position call
  /// @return bytes4 The function selector for the hook
  function afterModifyPosition(
    address sender,
    address recipient,
    int24 bottomTick,
    int24 topTick,
    int128 desiredLiquidityDelta,
    uint256 amount0,
    uint256 amount1,
    bytes calldata data
  ) external override returns (bytes4) {
    emit AfterModifyPosition(sender, recipient, bottomTick, topTick, desiredLiquidityDelta, amount0, amount1, data);
    if (!Plugins.hasFlag(selectorsDisableConfig, Plugins.AFTER_POSITION_MODIFY_FLAG)) return IAlgebraPlugin.afterModifyPosition.selector;
    return IAlgebraPlugin.defaultPluginConfig.selector;
  }

  /// @notice The hook called before a swap
  /// @param sender The initial msg.sender for the swap call
  /// @return bytes4 The function selector for the hook
  function beforeSwap(
    address sender,
    address recipient,
    bool zeroToOne,
    int256 amountRequired,
    uint160 limitSqrtPrice,
    bool withPaymentInAdvance,
    bytes calldata data
  ) external override returns (uint256, bytes4, uint24) {
    emit BeforeSwap(sender, recipient, zeroToOne, amountRequired, limitSqrtPrice, withPaymentInAdvance, data);
    if (!Plugins.hasFlag(selectorsDisableConfig, Plugins.BEFORE_SWAP_FLAG))
      return (amountInDecrease, IAlgebraPlugin.beforeSwap.selector, overrideFee);
    return (0, IAlgebraPlugin.defaultPluginConfig.selector, overrideFee);
  }

  /// @notice The hook called after swap calculation
  /// @param sender The initial msg.sender for the swap call
  /// @return bytes4 The function selector for the hook
  function afterSwapCalculation(
    address sender,
    address recipient,
    bool zeroToOne,
    int256 amountRequired,
    uint160 limitSqrtPrice,
    int256 amount0,
    int256 amount1,
    bytes calldata data
  ) external override returns (bytes4, uint256, uint256) {
    emit AfterSwapCalculation(sender, recipient, zeroToOne, amountRequired, limitSqrtPrice, amount0, amount1, data);
    if (!Plugins.hasFlag(selectorsDisableConfig, Plugins.AFTER_SWAP_CALCULATION_FLAG))
      return (IAlgebraPlugin.afterSwapCalculation.selector, amountInIncrease, amountOutDecrease);
    return (IAlgebraPlugin.defaultPluginConfig.selector, 0, 0);
  }

  /// @notice The hook called after a swap
  /// @param sender The initial msg.sender for the swap call
  /// @return bytes4 The function selector for the hook
  function afterSwap(
    address sender,
    address recipient,
    bool zeroToOne,
    int256 amountRequired,
    uint160 limitSqrtPrice,
    int256 amount0,
    int256 amount1,
    uint256,
    bytes calldata data
  ) external override returns (bytes4) {
    emit AfterSwap(sender, recipient, zeroToOne, amountRequired, limitSqrtPrice, amount0, amount1, data);
    if (!Plugins.hasFlag(selectorsDisableConfig, Plugins.AFTER_SWAP_FLAG)) return IAlgebraPlugin.afterSwap.selector;
    return IAlgebraPlugin.defaultPluginConfig.selector;
  }

  /// @notice The hook called before flash
  /// @param sender The initial msg.sender for the flash call
  /// @param amount0 The amount of token0 being requested for flash
  /// @param amount1 The amount of token1 being requested for flash
  /// @return bytes4 The function selector for the hook
  function beforeFlash(address sender, address recipient, uint256 amount0, uint256 amount1, bytes calldata data) external override returns (bytes4) {
    emit BeforeFlash(sender, recipient, amount0, amount1, data);
    if (!Plugins.hasFlag(selectorsDisableConfig, Plugins.BEFORE_FLASH_FLAG)) return IAlgebraPlugin.beforeFlash.selector;
    return IAlgebraPlugin.defaultPluginConfig.selector;
  }

  /// @notice The hook called after flash
  /// @param sender The initial msg.sender for the flash call
  /// @param amount0 The amount of token0 being requested for flash
  /// @param amount1 The amount of token1 being requested for flash
  /// @return bytes4 The function selector for the hook
  function afterFlash(
    address sender,
    address recipient,
    uint256 amount0,
    uint256 amount1,
    uint256 paid0,
    uint256 paid1,
    bytes calldata data
  ) external override returns (bytes4) {
    emit AfterFlash(sender, recipient, amount0, amount1, paid0, paid1, data);
    if (!Plugins.hasFlag(selectorsDisableConfig, Plugins.AFTER_FLASH_FLAG)) return IAlgebraPlugin.afterFlash.selector;
    return IAlgebraPlugin.defaultPluginConfig.selector;
  }

  function swap() external {
    IAlgebraPool(pool).swap(address(this), true, 10000, 4295128740, '');
  }

  function algebraSwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata) external {
    require(amount0Delta > 0 || amount1Delta > 0, 'Zero liquidity swap'); // swaps entirely within 0-liquidity regions are not supported

    (address token, uint256 amountToPay) = amount0Delta > 0
      ? (IAlgebraPool(pool).token0(), uint256(amount0Delta))
      : (IAlgebraPool(pool).token1(), uint256(amount1Delta));

    TestERC20(token).transfer(pool, amountToPay);
  }

  function mint() external {
    IAlgebraPool(pool).mint(address(this), address(this), -60, 60, 1000, '');
  }

  function algebraMintCallback(uint256 amount0Owed, uint256 amount1Owed, bytes calldata) external {
    if (amount0Owed > 0) TestERC20(IAlgebraPool(pool).token0()).transfer(pool, amount0Owed);
    if (amount1Owed > 0) TestERC20(IAlgebraPool(pool).token1()).transfer(pool, amount1Owed);
  }

  function afterCross(
    bool zeroToOne,
    uint256 swapStepAmount,
    uint256 feeStepAmount,
    int24 tick,
    int128 liquidityDelta
  ) external override returns (bytes4) {
    emit AfterCross(zeroToOne, swapStepAmount, feeStepAmount, tick, liquidityDelta);
    if (!Plugins.hasFlag(selectorsDisableConfig, Plugins.AFTER_CROSS_FLAG)) return IAlgebraPlugin.afterCross.selector;
    return IAlgebraPlugin.defaultPluginConfig.selector;
  }
}
