// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.8.20;
pragma abicoder v1;

import '../interfaces/plugins/IVolatilityOracle.sol';
import '../interfaces/IBasePluginV1Factory.sol';
import './IAlgebraOracleV1TWAP.sol';

import '../libraries/integration/OracleLibrary.sol';

/// @title Algebra Integral 1.0 base plugin V1 oracle frontend
/// @notice Provides data from oracle corresponding pool
/// @dev These functions are not very gas efficient and it is better not to use them on-chain
contract AlgebraOracleV1TWAP is IAlgebraOracleV1TWAP {
  /// @inheritdoc IAlgebraOracleV1TWAP
  address public immutable override pluginFactory;

  constructor(address _pluginFactory) {
    pluginFactory = _pluginFactory;
  }

  /// @inheritdoc IAlgebraOracleV1TWAP
  function getQuoteAtTick(
    int24 tick,
    uint128 baseAmount,
    address baseToken,
    address quoteToken
  ) external pure override returns (uint256 quoteAmount) {
    return OracleLibrary.getQuoteAtTick(tick, baseAmount, baseToken, quoteToken);
  }

  /// @inheritdoc IAlgebraOracleV1TWAP
  function getAverageTick(address pool, uint32 period) external view override returns (int24 timeWeightedAverageTick, bool isConnected) {
    address oracleAddress = _getPluginForPool(pool);
    timeWeightedAverageTick = OracleLibrary.consult(oracleAddress, period);
    isConnected = OracleLibrary.isOracleConnectedToPool(oracleAddress, pool);
  }

  /// @inheritdoc IAlgebraOracleV1TWAP
  function latestTimestamp(address pool) external view override returns (uint32) {
    return IVolatilityOracle(_getPluginForPool(pool)).lastTimepointTimestamp();
  }

  /// @inheritdoc IAlgebraOracleV1TWAP
  function oldestTimestamp(address pool) external view override returns (uint32 _oldestTimestamp) {
    address oracle = _getPluginForPool(pool);
    (, _oldestTimestamp) = OracleLibrary.oldestTimepointMetadata(oracle);
  }

  /// @inheritdoc IAlgebraOracleV1TWAP
  function latestIndex(address pool) external view override returns (uint16) {
    return OracleLibrary.latestIndex(_getPluginForPool(pool));
  }

  /// @inheritdoc IAlgebraOracleV1TWAP
  function isOracleConnected(address pool) external view override returns (bool connected) {
    connected = OracleLibrary.isOracleConnectedToPool(_getPluginForPool(pool), pool);
  }

  /// @inheritdoc IAlgebraOracleV1TWAP
  function oldestIndex(address pool) external view override returns (uint16 _oldestIndex) {
    address oracle = _getPluginForPool(pool);
    (_oldestIndex, ) = OracleLibrary.oldestTimepointMetadata(oracle);
  }

  function _getPluginForPool(address pool) internal view returns (address) {
    address pluginAddress = IBasePluginV1Factory(pluginFactory).pluginByPool(pool);
    require(pluginAddress != address(0), 'Oracle does not exist');
    return pluginAddress;
  }
}
