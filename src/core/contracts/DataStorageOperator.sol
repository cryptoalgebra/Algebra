// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.17;

import './base/Timestamp.sol';
import './interfaces/IAlgebraFactory.sol';
import './interfaces/IDataStorageOperator.sol';
import './interfaces/pool/IAlgebraPoolState.sol';

import './libraries/DataStorage.sol';
import './libraries/AdaptiveFee.sol';

contract DataStorageOperator is IDataStorageOperator, Timestamp {
  uint256 constant UINT16_MODULO = 65536;

  using DataStorage for DataStorage.Timepoint[UINT16_MODULO];

  DataStorage.Timepoint[UINT16_MODULO] public override timepoints;
  IAlgebraFeeConfiguration.Configuration public feeConfig;

  address private immutable pool;
  address private immutable factory;

  modifier onlyPool() {
    require(msg.sender == pool, 'only pool can call this');
    _;
  }

  constructor(address _pool) {
    factory = msg.sender;
    pool = _pool;
  }

  /// @inheritdoc IDataStorageOperator
  function initialize(uint32 time, int24 tick) external override onlyPool {
    return timepoints.initialize(time, tick);
  }

  /// @inheritdoc IDataStorageOperator
  function changeFeeConfiguration(IAlgebraFeeConfiguration.Configuration calldata _feeConfig) external override {
    require(msg.sender == factory || msg.sender == IAlgebraFactory(factory).owner());

    require(uint256(_feeConfig.alpha1) + uint256(_feeConfig.alpha2) + uint256(_feeConfig.baseFee) <= type(uint16).max, 'Max fee exceeded');
    require(_feeConfig.gamma1 != 0 && _feeConfig.gamma2 != 0, 'Gammas must be > 0');

    feeConfig = _feeConfig;
    emit FeeConfiguration(_feeConfig);
  }

  /// @inheritdoc IDataStorageOperator
  function getSingleTimepoint(
    uint32 time,
    uint32 secondsAgo,
    int24 tick,
    uint16 lastIndex
  ) external view override returns (int56 tickCumulative, uint112 volatilityCumulative) {
    DataStorage.Timepoint memory result = timepoints.getSingleTimepoint(time, secondsAgo, tick, lastIndex, timepoints.getOldestIndex(lastIndex));
    (tickCumulative, volatilityCumulative) = (result.tickCumulative, result.volatilityCumulative);
  }

  /// @inheritdoc IDataStorageOperator
  function getTimepoints(
    uint32[] memory secondsAgos
  ) external view override returns (int56[] memory tickCumulatives, uint112[] memory volatilityCumulatives) {
    (, int24 tick, , , uint16 index, , ) = IAlgebraPoolState(pool).globalState();
    return timepoints.getTimepoints(_blockTimestamp(), secondsAgos, tick, index);
  }

  /// @inheritdoc IDataStorageOperator
  function write(uint16 index, uint32 blockTimestamp, int24 tick) external override onlyPool returns (uint16 indexUpdated, uint16 newFee) {
    uint16 oldestIndex;
    (indexUpdated, oldestIndex) = timepoints.write(index, blockTimestamp, tick);

    if (index != indexUpdated) {
      IAlgebraFeeConfiguration.Configuration memory _feeConfig = feeConfig;
      if (_feeConfig.alpha1 == 0 && _feeConfig.alpha2 == 0) {
        newFee = _feeConfig.baseFee;
      } else {
        uint88 lastVolatilityCumulative = timepoints[indexUpdated].volatilityCumulative;
        uint88 volatilityAverage = timepoints.getAverageVolatility(blockTimestamp, tick, indexUpdated, oldestIndex, lastVolatilityCumulative);
        unchecked {
          newFee = AdaptiveFee.getFee(volatilityAverage, _feeConfig);
        }
      }
    }
  }
}
