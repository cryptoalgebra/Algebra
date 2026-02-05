// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/interfaces/plugin/IAlgebraPlugin.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import '../interfaces/IAlgebraEternalVirtualPool.sol';

/// @title Mock Farming Plugin for testing fee-based farming
/// @notice This plugin proxies afterCross and afterSwap hooks to virtual pool for fee tracking
contract MockFarmingPlugin is IAlgebraPlugin {

  address public immutable pool;
  

  address public virtualPool;
  

  uint8 public pluginConfig;

  event AfterCross(
    bool zeroToOne,
    uint256 swapStepAmount,
    uint256 feeStepAmount,
    int24 tick,
    int128 liquidityDelta,
    uint128 currentLiquidity
  );

  event AfterSwap(
    address sender,
    address recipient,
    bool zeroToOne,
    int256 amountRequired,
    uint160 limitSqrtPrice,
    int256 amount0,
    int256 amount1,
    uint256 feeAmount
  );

  error onlyPool();

  modifier _onlyPool() {
    if (msg.sender != pool) revert onlyPool();
    _;
  }

  constructor(address _pool) {
    pool = _pool;
  }


  function setIncentive(address _virtualPool) external {
    virtualPool = _virtualPool;
  }

  function getPool() external view returns (address) {
    return pool;
  } 

  function incentive() external view returns (address) {
    return virtualPool;
  }


  function setPluginConfig(uint8 _pluginConfig) external {
    pluginConfig = _pluginConfig;
  }

  /// @inheritdoc IAlgebraPlugin
  function defaultPluginConfig() external view override returns (uint16) {
    return uint16(pluginConfig);
  }

  /// @inheritdoc IAlgebraPlugin
  function handlePluginFee(uint256, uint256) external pure override returns (bytes4) {
    return IAlgebraPlugin.handlePluginFee.selector;
  }

  /// @inheritdoc IAlgebraPlugin
  function beforeInitialize(address, uint160) external pure override returns (bytes4) {
    return IAlgebraPlugin.beforeInitialize.selector;
  }

  /// @inheritdoc IAlgebraPlugin
  function afterInitialize(address, uint160, int24) external pure override returns (bytes4) {
    return IAlgebraPlugin.afterInitialize.selector;
  }

  /// @inheritdoc IAlgebraPlugin
  function beforeModifyPosition(
    address,
    address,
    int24,
    int24,
    int128,
    bytes calldata
  ) external pure override returns (bytes4, uint24) {
    return (IAlgebraPlugin.beforeModifyPosition.selector, 0);
  }

  /// @inheritdoc IAlgebraPlugin
  function afterModifyPosition(
    address,
    address,
    int24,
    int24,
    int128,
    uint256,
    uint256,
    bytes calldata
  ) external pure override returns (bytes4) {
    return IAlgebraPlugin.afterModifyPosition.selector;
  }

  /// @inheritdoc IAlgebraPlugin
  function beforeSwap(
    address,
    address,
    bool,
    int256,
    uint160,
    bool,
    bytes calldata
  ) external pure override returns (bytes4, uint24, uint24) {
    return (IAlgebraPlugin.beforeSwap.selector, 0, 0);
  }

  /// @inheritdoc IAlgebraPlugin
  function afterSwap(
    address sender,
    address recipient,
    bool zeroToOne,
    int256 amountRequired,
    uint160 limitSqrtPrice,
    int256 amount0,
    int256 amount1,
    uint256 feeAmount,
    bytes calldata
  ) external override _onlyPool returns (bytes4) {
    emit AfterSwap(sender, recipient, zeroToOne, amountRequired, limitSqrtPrice, amount0, amount1, feeAmount);
    
    address _virtualPool = virtualPool;
    if (_virtualPool != address(0) && feeAmount > 0) {

      (, int24 currentTick, , , , ) = IAlgebraPool(pool).globalState();
      uint128 poolLiquidity = IAlgebraPool(pool).liquidity();

      IAlgebraEternalVirtualPool(_virtualPool).afterSwap(zeroToOne, feeAmount, currentTick, poolLiquidity);
    }
    
    return IAlgebraPlugin.afterSwap.selector;
  }

  /// @inheritdoc IAlgebraPlugin
  function afterCross(
    bool zeroToOne,
    uint256 swapStepAmount,
    uint256 feeStepAmount,
    int24 tick,
    int128 liquidityDelta,
    uint128 currentLiquidity
  ) external override _onlyPool returns (bytes4) {
    emit AfterCross(zeroToOne, swapStepAmount, feeStepAmount, tick, liquidityDelta, currentLiquidity);
    
    address _virtualPool = virtualPool;
    if (_virtualPool != address(0)) {

      uint128 poolLiquidity = IAlgebraPool(pool).liquidity();
      

      IAlgebraEternalVirtualPool(_virtualPool).afterCross(zeroToOne, feeStepAmount, tick, poolLiquidity);
    }
    
    return IAlgebraPlugin.afterCross.selector;
  }

  /// @inheritdoc IAlgebraPlugin
  function beforeFlash(address, address, uint256, uint256, bytes calldata) external pure override returns (bytes4) {
    return IAlgebraPlugin.beforeFlash.selector;
  }

  /// @inheritdoc IAlgebraPlugin
  function afterFlash(
    address,
    address,
    uint256,
    uint256,
    uint256,
    uint256,
    bytes calldata
  ) external pure override returns (bytes4) {
    return IAlgebraPlugin.afterFlash.selector;
  }
}
