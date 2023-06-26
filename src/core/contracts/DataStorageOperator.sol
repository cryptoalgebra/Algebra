// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import './base/common/Timestamp.sol';

import './libraries/DataStorage.sol';
import './libraries/AdaptiveFee.sol';

import './interfaces/IAlgebraFactory.sol';
import './interfaces/IAlgebraPlugin.sol';
import './interfaces/IDataStorageOperator.sol';
import './interfaces/pool/IAlgebraPoolState.sol';
import './interfaces/IAlgebraPool.sol';

/// @title Algebra default plugin
/// @notice This contract stores timepoints and calculates adaptive fee and statistical averages
contract DataStorageOperator is IDataStorageOperator, Timestamp, IAlgebraPlugin {
  uint256 internal constant UINT16_MODULO = 65536;

  using DataStorage for DataStorage.Timepoint[UINT16_MODULO];

  DataStorage.Timepoint[UINT16_MODULO] public override timepoints;
  // TODO
  uint16 public override timepointIndex;

  AlgebraFeeConfiguration public feeConfig;

  /// @dev The role can be granted in AlgebraFactory
  bytes32 public constant FEE_CONFIG_MANAGER = keccak256('FEE_CONFIG_MANAGER');

  address private immutable pool;
  address private immutable factory;

  modifier onlyPool() {
    require(msg.sender == pool, 'only pool can call this');
    _;
  }

  constructor(address _pool) {
    (factory, pool) = (msg.sender, _pool);
  }

  function _getTickAndFeeInPool() internal view returns (int24 tick, uint16 fee) {
    (, tick, , fee, , , ) = IAlgebraPoolState(pool).globalState();
  }

  // ###### Volatility and TWAP oracle ######

  /// @inheritdoc IVolatilityOracle
  function initialize(uint32 time, int24 tick) external override onlyPool {
    return timepoints.initialize(time, tick);
  }

  /// @inheritdoc IVolatilityOracle
  function getSingleTimepoint(uint32 secondsAgo) external view override returns (int56 tickCumulative, uint112 volatilityCumulative) {
    (int24 tick, ) = _getTickAndFeeInPool();
    uint16 lastTimepointIndex = timepointIndex;
    uint16 oldestIndex = timepoints.getOldestIndex(lastTimepointIndex);
    DataStorage.Timepoint memory result = timepoints.getSingleTimepoint(_blockTimestamp(), secondsAgo, tick, lastTimepointIndex, oldestIndex);
    (tickCumulative, volatilityCumulative) = (result.tickCumulative, result.volatilityCumulative);
  }

  /// @inheritdoc IVolatilityOracle
  function getTimepoints(
    uint32[] memory secondsAgos
  ) external view override returns (int56[] memory tickCumulatives, uint112[] memory volatilityCumulatives) {
    (int24 tick, ) = _getTickAndFeeInPool();
    return timepoints.getTimepoints(_blockTimestamp(), secondsAgos, tick, timepointIndex);
  }

  /// @inheritdoc IVolatilityOracle
  function prepayTimepointsStorageSlots(uint16 startIndex, uint16 amount) external {
    require(!timepoints[startIndex].initialized); // if not initialized, then all subsequent ones too
    require(amount > 0 && type(uint16).max - startIndex >= amount);

    unchecked {
      for (uint256 i = startIndex; i < startIndex + amount; ++i) {
        timepoints[i].blockTimestamp = 1; // will be overwritten
      }
    }
  }

  function _writeTimepoint(uint32 blockTimestamp, int24 tick) internal returns (bool updated, uint16 newLastIndex, uint16 oldestIndex) {
    uint16 index = timepointIndex;
    (newLastIndex, oldestIndex) = timepoints.write(index, blockTimestamp, tick);

    if (index != newLastIndex) {
      timepointIndex = newLastIndex;
      updated = true;
    }
  }

  // ###### Fee manager ######

  /// @inheritdoc IDynamicFeeManager
  function changeFeeConfiguration(AlgebraFeeConfiguration calldata _config) external override {
    require(msg.sender == factory || IAlgebraFactory(factory).hasRoleOrOwner(FEE_CONFIG_MANAGER, msg.sender));
    AdaptiveFee.validateFeeConfiguration(_config);

    feeConfig = _config;
    emit FeeConfiguration(_config);
  }

  /// @inheritdoc IDynamicFeeManager
  function getCurrentFee() external view override returns (uint16 fee) {
    AlgebraFeeConfiguration memory _feeConfig = feeConfig;
    if (_feeConfig.alpha1 | _feeConfig.alpha2 == 0) {
      return _feeConfig.baseFee;
    } else {
      uint16 lastIndex = timepointIndex;
      uint16 oldestIndex = timepoints.getOldestIndex(lastIndex);
      (int24 tick, ) = _getTickAndFeeInPool();

      uint88 lastVolatilityCumulative = timepoints._getVolatilityCumulativeAt(_blockTimestamp(), 0, tick, lastIndex, oldestIndex);
      uint88 volatilityAverage = timepoints.getAverageVolatility(_blockTimestamp(), tick, lastIndex, oldestIndex, lastVolatilityCumulative);

      return AdaptiveFee.getFee(volatilityAverage, feeConfig);
    }
  }

  function _getFeeAtLastTimepoint(uint16 lastTimepointIndex, uint16 oldestTimepointIndex, int24 currentTick) internal view returns (uint16 fee) {
    AlgebraFeeConfiguration memory _feeConfig = feeConfig;
    if (_feeConfig.alpha1 | _feeConfig.alpha2 == 0) {
      return _feeConfig.baseFee;
    } else {
      uint88 lastVolatilityCumulative = timepoints[lastTimepointIndex].volatilityCumulative;
      uint88 volatilityAverage = timepoints.getAverageVolatility(
        _blockTimestamp(),
        currentTick,
        lastTimepointIndex,
        oldestTimepointIndex,
        lastVolatilityCumulative
      );
      return AdaptiveFee.getFee(volatilityAverage, _feeConfig);
    }
  }

  // ###### HOOKS ######

  function beforeInitialize(address, uint160) external view override onlyPool returns (bytes4) {
    revert('Not implemented');
  }

  function afterInitialize(address, uint160, int24 tick) external onlyPool returns (bytes4) {
    timepoints.initialize(_blockTimestamp(), tick);
    return IAlgebraPlugin.afterInitialize.selector;
  }

  function beforeModifyPosition(address) external view onlyPool returns (bytes4) {
    revert('Not implemented');
  }

  function afterModifyPosition(address) external onlyPool returns (bytes4) {
    (int24 tick, uint16 fee) = _getTickAndFeeInPool(); // TODO optimize
    (bool updated, uint16 lastIndex, uint16 oldestIndex) = _writeTimepoint(_blockTimestamp(), tick);
    if (updated) {
      uint16 newFee = _getFeeAtLastTimepoint(lastIndex, oldestIndex, tick);

      if (newFee != fee) {
        IAlgebraPool(pool).setFee(newFee);
      }
    }

    return IAlgebraPlugin.afterModifyPosition.selector;
  }

  function beforeSwap(address) external onlyPool returns (bytes4) {
    (int24 tick, uint16 fee) = _getTickAndFeeInPool();
    (bool updated, uint16 lastIndex, uint16 oldestIndex) = _writeTimepoint(_blockTimestamp(), tick);
    if (updated) {
      uint16 newFee = _getFeeAtLastTimepoint(lastIndex, oldestIndex, tick);

      if (newFee != fee) {
        IAlgebraPool(pool).setFee(newFee);
      }
    }
    return IAlgebraPlugin.beforeSwap.selector;
  }

  function afterSwap(address) external onlyPool returns (bytes4) {
    // TODO farm logic
    return IAlgebraPlugin.afterSwap.selector;
  }

  function beforeFlash(address, uint256, uint256) external view onlyPool returns (bytes4) {
    revert('Not implemented');
  }

  function afterFlash(address, uint256, uint256) external view onlyPool returns (bytes4) {
    revert('Not implemented');
  }
}
