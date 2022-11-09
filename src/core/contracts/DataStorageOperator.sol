// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;
pragma abicoder v2;

import './interfaces/IAlgebraFactory.sol';
import './interfaces/IDataStorageOperator.sol';
import './interfaces/pool/IAlgebraPoolState.sol';

import './libraries/DataStorage.sol';
import './libraries/Sqrt.sol';
import './libraries/AdaptiveFee.sol';

import './libraries/Constants.sol';

contract DataStorageOperator is IDataStorageOperator {
  uint256 constant UINT16_MODULO = 65536;
  uint128 constant MAX_VOLUME_PER_LIQUIDITY = 100000 << 64; // maximum meaningful ratio of volume to liquidity

  using DataStorage for DataStorage.Timepoint[UINT16_MODULO];

  DataStorage.Timepoint[UINT16_MODULO] public override timepoints;
  AdaptiveFee.Configuration public feeConfig;

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
  function changeFeeConfiguration(AdaptiveFee.Configuration calldata _feeConfig) external override {
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
    uint16 index,
    uint128 liquidity
  )
    external
    view
    override
    returns (
      int56 tickCumulative,
      uint160 secondsPerLiquidityCumulative,
      uint112 volatilityCumulative
    )
  {
    uint16 oldestIndex;
    // check if we have overflow in the past
    uint16 nextIndex = index + 1; // considering overflow
    if (timepoints[nextIndex].initialized) {
      oldestIndex = nextIndex;
    }

    DataStorage.Timepoint memory result = timepoints.getSingleTimepoint(time, secondsAgo, tick, index, oldestIndex, liquidity);
    (tickCumulative, secondsPerLiquidityCumulative, volatilityCumulative) = (
      result.tickCumulative,
      result.secondsPerLiquidityCumulative,
      result.volatilityCumulative
    );
  }

  /// @inheritdoc IDataStorageOperator
  function getTimepointsWithParams(
    uint32 time,
    uint32[] memory secondsAgos,
    int24 tick,
    uint16 index,
    uint128 liquidity
  )
    public
    view
    override
    returns (
      int56[] memory tickCumulatives,
      uint160[] memory secondsPerLiquidityCumulatives,
      uint112[] memory volatilityCumulatives
    )
  {
    return timepoints.getTimepoints(time, secondsAgos, tick, index, liquidity);
  }

  /// @inheritdoc IDataStorageOperator
  function getTimepoints(uint32[] memory secondsAgos)
    external
    view
    override
    returns (
      int56[] memory tickCumulatives,
      uint160[] memory secondsPerLiquidityCumulatives,
      uint112[] memory volatilityCumulatives
    )
  {
    uint32 time = uint32(block.timestamp); // TODO MOVE TO ABSTRACT
    (, int24 tick, , , uint16 index, , ) = IAlgebraPoolState(pool).globalState();
    uint128 liquidity = IAlgebraPoolState(pool).liquidity();
    return timepoints.getTimepoints(time, secondsAgos, tick, index, liquidity);
  }

  /// @inheritdoc IDataStorageOperator
  function getAverageVolatility(
    uint32 time,
    int24 tick,
    uint16 index,
    uint128 liquidity
  ) external view override returns (uint112 TWVolatilityAverage) {
    return timepoints.getAverageVolatility(time, tick, index, liquidity);
  }

  /// @inheritdoc IDataStorageOperator
  function write(
    uint16 index,
    uint32 blockTimestamp,
    int24 tick,
    uint128 liquidity
  ) external override onlyPool returns (uint16 indexUpdated) {
    return timepoints.write(index, blockTimestamp, tick, liquidity);
  }

  /// @inheritdoc IDataStorageOperator
  function window() external pure override returns (uint32) {
    return DataStorage.WINDOW;
  }

  /// @inheritdoc IDataStorageOperator
  function getFee(
    uint32 _time,
    int24 _tick,
    uint16 _index,
    uint128 _liquidity
  ) external view override returns (uint16 fee) {
    uint88 volatilityAverage = timepoints.getAverageVolatility(_time, _tick, _index, _liquidity);
    return AdaptiveFee.getFee(volatilityAverage / 15, feeConfig); // TODO CONST
  }
}
