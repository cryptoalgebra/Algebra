// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '@cryptoalgebra/integral-core/contracts/libraries/TickMath.sol';

import '../libraries/AdaptiveFee.sol';
import '../libraries/VolatilityOracle.sol';
import '../types/AlgebraFeeConfigurationU144.sol';
import './VolatilityOracleTest.sol';

/// @notice Contract used in simulations with historical data
contract SimulationAdaptiveFee is VolatilityOracleTest {
  uint256 private constant UINT16_MODULO = 65536;
  using VolatilityOracle for VolatilityOracle.Timepoint[UINT16_MODULO];
  using AlgebraFeeConfigurationU144Lib for AlgebraFeeConfiguration;

  AlgebraFeeConfigurationU144 private _feeConfig;

  constructor() VolatilityOracleTest() {}

  function init(int24 initTick, uint32 initTime) external {
    initTime = initTime;
    time = initTime;
    tick = initTick;

    timepoints.initialize(initTime, tick);

    _feeConfig = AdaptiveFee.initialFeeConfiguration().pack();
  }

  function getFee() external view returns (uint16 fee, uint88 volatilityAverage, int24 averageTick) {
    uint32 _time = time;
    int24 _tick = tick;
    uint16 lastIndex = index;
    AlgebraFeeConfigurationU144 feeConfig_ = _feeConfig;

    uint16 oldestIndex = timepoints.getOldestIndex(lastIndex);

    volatilityAverage = timepoints.getAverageVolatility(_time, _tick, lastIndex, oldestIndex);
    averageTick = timepoints[lastIndex].averageTick;
    return (AdaptiveFee.getFee(volatilityAverage, feeConfig_), volatilityAverage, averageTick);
  }

  function changeFeeConfiguration(AlgebraFeeConfiguration calldata _config) external {
    AdaptiveFee.validateFeeConfiguration(_config);
    _feeConfig = _config.pack(); // pack struct to uint144 and write in storage
  }
}
