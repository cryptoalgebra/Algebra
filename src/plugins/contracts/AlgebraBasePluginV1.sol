// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.20;

import '@cryptoalgebra/core/contracts/base/common/Timestamp.sol';
import '@cryptoalgebra/core/contracts/libraries/Plugins.sol';

import '@cryptoalgebra/core/contracts/interfaces/IAlgebraFactory.sol';
import '@cryptoalgebra/core/contracts/interfaces/plugin/IAlgebraPlugin.sol';
import '@cryptoalgebra/core/contracts/interfaces/pool/IAlgebraPoolState.sol';
import '@cryptoalgebra/core/contracts/interfaces/IAlgebraPool.sol';

import './interfaces/IAlgebraBasePluginV1.sol';
import './interfaces/IBasePluginV1Factory.sol';
import './interfaces/IAlgebraVirtualPool.sol';

import './libraries/VolatilityOracle.sol';
import './libraries/AdaptiveFee.sol';

/// @title Algebra default plugin
/// @notice This contract stores timepoints and calculates adaptive fee and statistical averages
contract AlgebraBasePluginV1 is IAlgebraBasePluginV1, Timestamp, IAlgebraPlugin {
  uint256 internal constant UINT16_MODULO = 65536;

  using VolatilityOracle for VolatilityOracle.Timepoint[UINT16_MODULO];

  /// @dev The role can be granted in AlgebraFactory
  bytes32 public constant FEE_CONFIG_MANAGER = keccak256('FEE_CONFIG_MANAGER');

  /// @inheritdoc IAlgebraPlugin
  uint8 public constant override defaultPluginConfig =
    uint8(Plugins.AFTER_INIT_FLAG | Plugins.BEFORE_SWAP_FLAG | Plugins.AFTER_POSITION_MODIFY_FLAG | Plugins.DYNAMIC_FEE);

  /// @inheritdoc IFarmingPlugin
  address public immutable override pool;
  address private immutable factory;
  address private immutable pluginFactory;

  /// @inheritdoc IVolatilityOracle
  VolatilityOracle.Timepoint[UINT16_MODULO] public override timepoints;

  /// @inheritdoc IVolatilityOracle
  uint16 public override timepointIndex;

  /// @inheritdoc IVolatilityOracle
  uint32 public override lastTimepointTimestamp;

  /// @inheritdoc IFarmingPlugin
  address public override incentive;

  /// @inheritdoc IDynamicFeeManager
  AlgebraFeeConfiguration public feeConfig;

  modifier onlyPool() {
    require(msg.sender == pool, 'only pool can call this');
    _;
  }

  constructor(address _pool, address _factory, address _pluginFactory) {
    (factory, pool, pluginFactory) = (_factory, _pool, _pluginFactory);
  }

  function _getPoolState() internal view returns (uint160 price, int24 tick, uint16 fee, uint8 pluginConfig) {
    (price, tick, fee, pluginConfig, , ) = IAlgebraPoolState(pool).globalState();
  }

  /// @inheritdoc IAlgebraBasePluginV1
  function initialize() external override {
    require(!timepoints[0].initialized, 'Already initialized');
    require(IAlgebraPool(pool).plugin() == address(this), 'Plugin not attached');
    (uint160 price, int24 tick, , ) = _getPoolState();
    require(price != 0, 'Pool is not initialized');

    uint32 time = _blockTimestamp();
    lastTimepointTimestamp = time;
    timepoints.initialize(time, tick);

    IAlgebraPool(pool).setPluginConfig(defaultPluginConfig);
  }

  // ###### Volatility and TWAP oracle ######

  /// @inheritdoc IVolatilityOracle
  function getSingleTimepoint(uint32 secondsAgo) external view override returns (int56 tickCumulative, uint112 volatilityCumulative) {
    (, int24 tick, , ) = _getPoolState();
    uint16 lastTimepointIndex = timepointIndex;
    uint16 oldestIndex = timepoints.getOldestIndex(lastTimepointIndex);
    VolatilityOracle.Timepoint memory result = timepoints.getSingleTimepoint(_blockTimestamp(), secondsAgo, tick, lastTimepointIndex, oldestIndex);
    (tickCumulative, volatilityCumulative) = (result.tickCumulative, result.volatilityCumulative);
  }

  /// @inheritdoc IVolatilityOracle
  function getTimepoints(
    uint32[] memory secondsAgos
  ) external view override returns (int56[] memory tickCumulatives, uint112[] memory volatilityCumulatives) {
    (, int24 tick, , ) = _getPoolState();
    return timepoints.getTimepoints(_blockTimestamp(), secondsAgos, tick, timepointIndex);
  }

  /// @inheritdoc IVolatilityOracle
  function prepayTimepointsStorageSlots(uint16 startIndex, uint16 amount) external override {
    require(!timepoints[startIndex].initialized); // if not initialized, then all subsequent ones too
    require(amount > 0 && type(uint16).max - startIndex >= amount);

    unchecked {
      for (uint256 i = startIndex; i < startIndex + amount; ++i) {
        timepoints[i].blockTimestamp = 1; // will be overwritten
      }
    }
  }

  // ###### Fee manager ######

  /// @inheritdoc IDynamicFeeManager
  function changeFeeConfiguration(AlgebraFeeConfiguration calldata _config) external override {
    require(msg.sender == pluginFactory || IAlgebraFactory(factory).hasRoleOrOwner(FEE_CONFIG_MANAGER, msg.sender));
    AdaptiveFee.validateFeeConfiguration(_config);

    feeConfig = _config;
    emit FeeConfiguration(_config);
  }

  /// @inheritdoc IAlgebraDynamicFeePlugin
  function getCurrentFee() external view override returns (uint16 fee) {
    AlgebraFeeConfiguration memory _feeConfig = feeConfig;
    if (_feeConfig.alpha1 | _feeConfig.alpha2 == 0) {
      return _feeConfig.baseFee;
    } else {
      uint16 lastIndex = timepointIndex;
      uint16 oldestIndex = timepoints.getOldestIndex(lastIndex);
      (, int24 tick, , ) = _getPoolState();

      uint88 volatilityAverage = timepoints.getAverageVolatility(_blockTimestamp(), tick, lastIndex, oldestIndex);

      return AdaptiveFee.getFee(volatilityAverage, feeConfig);
    }
  }

  function _getFeeAtLastTimepoint(uint16 lastTimepointIndex, uint16 oldestTimepointIndex, int24 currentTick) internal view returns (uint16 fee) {
    AlgebraFeeConfiguration memory _feeConfig = feeConfig;
    if (_feeConfig.alpha1 | _feeConfig.alpha2 == 0) {
      return _feeConfig.baseFee;
    } else {
      uint88 volatilityAverage = timepoints.getAverageVolatility(_blockTimestamp(), currentTick, lastTimepointIndex, oldestTimepointIndex);
      return AdaptiveFee.getFee(volatilityAverage, _feeConfig);
    }
  }

  // ###### Farming plugin ######

  /// @inheritdoc IFarmingPlugin
  function setIncentive(address newIncentive) external override {
    require(msg.sender == IBasePluginV1Factory(pluginFactory).farmingAddress());

    bool turnOn = newIncentive != address(0);
    address currentIncentive = incentive;

    require(currentIncentive != newIncentive, 'already active');
    if (currentIncentive != address(0)) require(!turnOn, 'has active incentive');

    incentive = newIncentive;
    emit Incentive(newIncentive);

    (, , , uint8 pluginConfig) = _getPoolState();
    bool isHookActive = pluginConfig & uint8(Plugins.AFTER_SWAP_FLAG) != 0;
    if (turnOn != isHookActive) {
      pluginConfig = pluginConfig ^ uint8(Plugins.AFTER_SWAP_FLAG);
      IAlgebraPool(pool).setPluginConfig(pluginConfig);
    }
  }

  /// @inheritdoc IFarmingPlugin
  function isIncentiveActive(address targetIncentive) external view override returns (bool) {
    if (incentive != targetIncentive) return false;
    if (IAlgebraPool(pool).plugin() != address(this)) return false;
    (, , , uint8 pluginConfig) = _getPoolState();
    if (pluginConfig & uint8(Plugins.AFTER_SWAP_FLAG) == 0) return false;

    return true;
  }

  // ###### HOOKS ######

  function beforeInitialize(address, uint160) external override onlyPool returns (bytes4) {
    uint8 newPluginConfig = defaultPluginConfig;
    if (incentive != address(0)) newPluginConfig |= uint8(Plugins.AFTER_SWAP_FLAG);

    IAlgebraPool(msg.sender).setPluginConfig(newPluginConfig);
    return IAlgebraPlugin.beforeInitialize.selector;
  }

  function afterInitialize(address, uint160, int24 tick) external override onlyPool returns (bytes4) {
    lastTimepointTimestamp = _blockTimestamp();
    timepoints.initialize(_blockTimestamp(), tick);

    IAlgebraPool(pool).setFee(feeConfig.baseFee);
    return IAlgebraPlugin.afterInitialize.selector;
  }

  function beforeModifyPosition(address, address, int24, int24, int128, bytes calldata) external view override onlyPool returns (bytes4) {
    revert('Not implemented');
  }

  function afterModifyPosition(address, address, int24, int24, int128, uint256, uint256, bytes calldata) external override onlyPool returns (bytes4) {
    _writeTimepointAndUpdateFee();
    return IAlgebraPlugin.afterModifyPosition.selector;
  }

  function beforeSwap(address, address, bool, int256, uint160, bool, bytes calldata) external override onlyPool returns (bytes4) {
    _writeTimepointAndUpdateFee();
    return IAlgebraPlugin.beforeSwap.selector;
  }

  function afterSwap(address, address, bool zeroToOne, int256, uint160, int256, int256, bytes calldata) external override onlyPool returns (bytes4) {
    (, int24 tick, , ) = _getPoolState();
    IAlgebraVirtualPool(incentive).crossTo(tick, zeroToOne);
    return IAlgebraPlugin.afterSwap.selector;
  }

  function beforeFlash(address, address, uint256, uint256, bytes calldata) external view override onlyPool returns (bytes4) {
    revert('Not implemented');
  }

  function afterFlash(address, address, uint256, uint256, uint256, uint256, bytes calldata) external view override onlyPool returns (bytes4) {
    revert('Not implemented');
  }

  function _writeTimepointAndUpdateFee() internal {
    (uint16 _lastIndex, uint32 _lastTimepointTimestamp) = (timepointIndex, lastTimepointTimestamp);
    uint32 currentTimestamp = _blockTimestamp();

    if (_lastTimepointTimestamp == currentTimestamp) return;

    (, int24 tick, uint16 fee, ) = _getPoolState();
    (uint16 newLastIndex, uint16 oldestIndex) = timepoints.write(_lastIndex, currentTimestamp, tick);

    timepointIndex = newLastIndex;
    lastTimepointTimestamp = currentTimestamp;

    uint16 newFee = _getFeeAtLastTimepoint(newLastIndex, oldestIndex, tick);
    if (newFee != fee) {
      IAlgebraPool(pool).setFee(newFee);
    }
  }
}
