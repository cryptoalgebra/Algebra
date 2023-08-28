// SPDX-License-Identifier: GPL-2
pragma solidity =0.8.20;
pragma abicoder v1;

import '../interfaces/plugins/IVolatilityOracle.sol';
import '../interfaces/IBasePluginV1Factory.sol';
import './IAlgebraOracleV1TWAP.sol';

import '../libraries/integration/OracleLibrary.sol';

/// @title Algebra base plugin V1 oracle frontend
/// @notice Provides data from oracle corresponding pool
/// @dev These functions are not very gas efficient and it is better not to use them on-chain
contract AlgebraOracleV1TWAP is IAlgebraOracleV1TWAP {
  /// @inheritdoc IAlgebraOracleV1TWAP
  address public immutable override pluginFactory;

  constructor(address _pluginFactory) {
    pluginFactory = _pluginFactory;
  }

  /// @inheritdoc IAlgebraOracleV1TWAP
  function getQuoteAtTick(int24 tick, uint128 baseAmount, address baseToken, address quoteToken) external pure returns (uint256 quoteAmount) {
    return OracleLibrary.getQuoteAtTick(tick, baseAmount, baseToken, quoteToken);
  }

  /// @inheritdoc IAlgebraOracleV1TWAP
  function getAverageTick(address pool, uint32 period) external view returns (int24 timeWeightedAverageTick) {
    return OracleLibrary.consult(_getPluginForPool(pool), period);
  }

  /// @inheritdoc IAlgebraOracleV1TWAP
  function latestTimestamp(address pool) external view returns (uint32) {
    return IVolatilityOracle(_getPluginForPool(pool)).lastTimepointTimestamp();
  }

  /// @inheritdoc IAlgebraOracleV1TWAP
  function oldestTimestamp(address pool) external view returns (uint32 _oldestTimestamp) {
    address oracle = _getPluginForPool(pool);
    uint16 _lastIndex = _latestIndex(oracle);
    unchecked {
      // overflows are desired
      bool hasOverflowInPast;
      (hasOverflowInPast, _oldestTimestamp) = _timepoint(oracle, _lastIndex + 1);
      if (hasOverflowInPast) return _oldestTimestamp;
    }
    (, _oldestTimestamp) = _timepoint(oracle, 0);
    return _oldestTimestamp;
  }

  /// @inheritdoc IAlgebraOracleV1TWAP
  function latestIndex(address pool) external view returns (uint16) {
    return _latestIndex(_getPluginForPool(pool));
  }

  /// @inheritdoc IAlgebraOracleV1TWAP
  function oldestIndex(address pool) external view returns (uint16) {
    address oracle = _getPluginForPool(pool);
    uint16 _lastIndex = _latestIndex(oracle);
    unchecked {
      // overflows are desired
      (bool hasOverflowInPast, ) = _timepoint(oracle, _lastIndex + 1);
      if (hasOverflowInPast) return _lastIndex + 1;
    }
    return 0;
  }

  function _latestIndex(address oracle) internal view returns (uint16) {
    return (IVolatilityOracle(oracle).timepointIndex());
  }

  function _timepoint(address oracle, uint16 index) internal view returns (bool initialized, uint32 timestamp) {
    (initialized, timestamp, , , , , ) = IVolatilityOracle(oracle).timepoints(index);
  }

  function _getPluginForPool(address pool) internal view returns (address) {
    address pluginAddress = IBasePluginV1Factory(pluginFactory).pluginByPool(pool);
    require(pluginAddress != address(0), 'Oracle does not exist');
    return pluginAddress;
  }
}
