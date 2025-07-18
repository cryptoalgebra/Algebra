// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/libraries/Plugins.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/plugin/IAlgebraPlugin.sol';

import './plugins/DynamicFeePlugin.sol';
import './plugins/VolatilityOraclePlugin.sol';
import './plugins/SlidingFeePlugin.sol';
import './plugins/SecurityPlugin.sol';
import './plugins/FarmingProxyPlugin.sol';
import './plugins/AlmPlugin.sol';

/// @title Algebra Integral 1.2.1 plugin. Contains adaptive + sliding fee, safety switch and twap oracle
contract HydrexBasePlugin is DynamicFeePlugin, VolatilityOraclePlugin, SlidingFeePlugin, SecurityPlugin, FarmingProxyPlugin, AlmPlugin {
  using Plugins for uint8;
  using VolatilityOracle for VolatilityOracle.Timepoint[UINT16_MODULO];
  
  /// @inheritdoc IAlgebraPlugin
  uint8 public constant override defaultPluginConfig =
    uint8(
      Plugins.BEFORE_POSITION_MODIFY_FLAG |
        Plugins.AFTER_INIT_FLAG |
        Plugins.BEFORE_SWAP_FLAG |
        Plugins.AFTER_SWAP_FLAG |
        Plugins.DYNAMIC_FEE |
        Plugins.BEFORE_FLASH_FLAG
    );

  constructor(
    address _pool,
    address _factory,
    address _pluginFactory,
    AlgebraFeeConfiguration memory _config,
    uint16 _baseFee
  ) AlgebraBasePlugin(_pool, _factory, _pluginFactory) DynamicFeePlugin(_config) SlidingFeePlugin(_baseFee) {}

  // ###### HOOKS ######

  function beforeInitialize(address, uint160) external override onlyPool returns (bytes4) {
    _updatePluginConfigInPool(defaultPluginConfig);
    return IAlgebraPlugin.beforeInitialize.selector;
  }

  function afterInitialize(address, uint160, int24 tick) external override onlyPool returns (bytes4) {
    _initialize_TWAP(tick);
    return IAlgebraPlugin.afterInitialize.selector;
  }

  /// @dev unused
  function beforeModifyPosition(
    address,
    address,
    int24,
    int24,
    int128 liquidity,
    bytes calldata
  ) external override onlyPool returns (bytes4, uint24) {
    if (liquidity < 0) {
      _checkStatusOnBurn();
    } else {
      _checkStatus();
    }
    return (IAlgebraPlugin.beforeModifyPosition.selector, 0);
  }

  /// @dev unused
  function afterModifyPosition(address, address, int24, int24, int128, uint256, uint256, bytes calldata) external override onlyPool returns (bytes4) {
    _updatePluginConfigInPool(defaultPluginConfig); // should not be called, reset config
    return IAlgebraPlugin.afterModifyPosition.selector;
  }

  function beforeSwap(
    address,
    address,
    bool zeroToOne,
    int256,
    uint160,
    bool,
    bytes calldata
  ) external override onlyPool returns (bytes4, uint24, uint24) {
    uint16 newFee;
    bool _dynamicFeeEnabled = dynamicFeeEnabled;
    /// security plugin check
    _checkStatus();
    /// get ticks for slidiing fee calculation
    (, int24 currentTick, , ) = _getPoolState();
    int24 lastTick = _getLastTick();
    /// write timepoint to oracle
    _writeTimepoint();
    /// calculate volatility and dynamic fee if enabled
    if (_dynamicFeeEnabled) {
      uint88 volatilityAverage = _getAverageVolatilityLast();
      newFee = _getCurrentFee(volatilityAverage);
    }
    /// calcucalate sliding fee based on dynamic fee if enabled
    if (slidingFeeEnabled) {
      newFee = _getFeeAndUpdateFactors(zeroToOne, currentTick, lastTick, _dynamicFeeEnabled, newFee);
    }

    return (IAlgebraPlugin.beforeSwap.selector, newFee, 0);
  }

  function afterSwap(address, address, bool zeroToOne, int256, uint160, int256, int256, bytes calldata) external override onlyPool returns (bytes4) {
    if (rebalanceManager == address(0) || !_ableToGetTimepoints(slowTwapPeriod)) return IAlgebraPlugin.afterSwap.selector;

    ( , int24 currentTick, , ) = _getPoolState();
    uint32 lastBlockTimestamp = _getLastBlockTimestamp();

    int24 slowTwapTick = _getTwapTick(slowTwapPeriod);
    int24 fastTwapTick = _getTwapTick(fastTwapPeriod);

    _obtainTWAPAndRebalance(currentTick, slowTwapTick, fastTwapTick, lastBlockTimestamp);

    _updateVirtualPoolTick(zeroToOne);
    return IAlgebraPlugin.afterSwap.selector;
  }

  /// @dev unused
  function beforeFlash(address, address, uint256, uint256, bytes calldata) external override onlyPool returns (bytes4) {
    _checkStatus();
    return IAlgebraPlugin.beforeFlash.selector;
  }

  /// @dev unused
  function afterFlash(address, address, uint256, uint256, uint256, uint256, bytes calldata) external override onlyPool returns (bytes4) {
    _updatePluginConfigInPool(defaultPluginConfig); // should not be called, reset config
    return IAlgebraPlugin.afterFlash.selector;
  }

  function getCurrentFee() external view override returns (uint16 fee) {
    uint88 volatilityAverage = _getAverageVolatilityLast();
    fee = _getCurrentFee(volatilityAverage);
  }

  function _getLastBlockTimestamp() private view returns (uint32 blockTimestamp) {
    VolatilityOracle.Timepoint memory lastTimepoint = timepoints[timepointIndex];
    return lastTimepoint.blockTimestamp;
  }

  function _getTwapTick(uint32 period) private view returns (int24 timeWeightedAverageTick) {
    require(period != 0, 'Period is zero');

    uint32[] memory secondAgos = new uint32[](2);
    secondAgos[0] = period;
    secondAgos[1] = 0;

    (, int24 tick, , ) = _getPoolState();
    (int56[] memory tickCumulatives, ) = timepoints.getTimepoints(_blockTimestamp(), secondAgos, tick, timepointIndex);

    int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];

    timeWeightedAverageTick = int24(tickCumulativesDelta / int56(uint56(period)));

    // Always round to negative infinity
    if (tickCumulativesDelta < 0 && (tickCumulativesDelta % int56(uint56(period)) != 0)) timeWeightedAverageTick--;
  }

  function _ableToGetTimepoints(uint32 period) private view returns (bool) {
    uint16 lastIndex = timepoints.getOldestIndex(timepointIndex);
    uint32 oldestTimestamp = timepoints[lastIndex].blockTimestamp;

    return VolatilityOracle._lteConsideringOverflow(oldestTimestamp, _blockTimestamp() - period, _blockTimestamp());
  }
}
