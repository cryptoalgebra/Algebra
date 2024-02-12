// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.4;

import '@cryptoalgebra/integral-core/contracts/libraries/FullMath.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/TickMath.sol';
import '@cryptoalgebra/integral-core/contracts/libraries/Plugins.sol';
import '@cryptoalgebra/integral-core/contracts/interfaces/IAlgebraPool.sol';
import '@cryptoalgebra/integral-periphery/contracts/libraries/PoolAddress.sol';

import '../../interfaces/plugins/IVolatilityOracle.sol';

/// @title Oracle library
/// @notice Provides functions to integrate with Algebra pool TWAP VolatilityOracle
library OracleLibrary {
  /// @notice Fetches time-weighted average tick using Algebra VolatilityOracle
  /// @param oracleAddress The address of oracle
  /// @param period Number of seconds in the past to start calculating time-weighted average
  /// @return timeWeightedAverageTick The time-weighted average tick from (block.timestamp - period) to block.timestamp
  function consult(address oracleAddress, uint32 period) internal view returns (int24 timeWeightedAverageTick) {
    require(period != 0, 'Period is zero');

    uint32[] memory secondAgos = new uint32[](2);
    secondAgos[0] = period;
    secondAgos[1] = 0;

    IVolatilityOracle oracle = IVolatilityOracle(oracleAddress);
    (int56[] memory tickCumulatives, ) = oracle.getTimepoints(secondAgos);
    int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];

    timeWeightedAverageTick = int24(tickCumulativesDelta / int56(uint56(period)));

    // Always round to negative infinity
    if (tickCumulativesDelta < 0 && (tickCumulativesDelta % int56(uint56(period)) != 0)) timeWeightedAverageTick--;
  }

  /// @notice Given a tick and a token amount, calculates the amount of token received in exchange
  /// @param tick Tick value used to calculate the quote
  /// @param baseAmount Amount of token to be converted
  /// @param baseToken Address of an ERC20 token contract used as the baseAmount denomination
  /// @param quoteToken Address of an ERC20 token contract used as the quoteAmount denomination
  /// @return quoteAmount Amount of quoteToken received for baseAmount of baseToken
  function getQuoteAtTick(int24 tick, uint128 baseAmount, address baseToken, address quoteToken) internal pure returns (uint256 quoteAmount) {
    uint160 sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tick);

    // Calculate quoteAmount with better precision if it doesn't overflow when multiplied by itself
    if (sqrtRatioX96 <= type(uint128).max) {
      uint256 ratioX192 = uint256(sqrtRatioX96) * sqrtRatioX96;
      quoteAmount = baseToken < quoteToken ? FullMath.mulDiv(ratioX192, baseAmount, 1 << 192) : FullMath.mulDiv(1 << 192, baseAmount, ratioX192);
    } else {
      uint256 ratioX128 = FullMath.mulDiv(sqrtRatioX96, sqrtRatioX96, 1 << 64);
      quoteAmount = baseToken < quoteToken ? FullMath.mulDiv(ratioX128, baseAmount, 1 << 128) : FullMath.mulDiv(1 << 128, baseAmount, ratioX128);
    }
  }

  /// @notice Fetches metadata of last available record (most recent) in oracle
  /// @param oracleAddress The address of oracle
  /// @return index The index of last available record (most recent) in oracle
  /// @return timestamp The timestamp of last available record (most recent) in oracle, truncated to uint32
  function lastTimepointMetadata(address oracleAddress) internal view returns (uint16 index, uint32 timestamp) {
    index = latestIndex(oracleAddress);
    timestamp = IVolatilityOracle(oracleAddress).lastTimepointTimestamp();
  }

  /// @notice Fetches metadata of oldest available record in oracle
  /// @param oracleAddress The address of oracle
  /// @return index The index of oldest available record in oracle
  /// @return timestamp The timestamp of oldest available record in oracle, truncated to uint32
  function oldestTimepointMetadata(address oracleAddress) internal view returns (uint16 index, uint32 timestamp) {
    uint16 lastIndex = latestIndex(oracleAddress);
    bool initialized;
    unchecked {
      // overflow is desired
      index = lastIndex + 1;
      (initialized, timestamp) = timepointMetadata(oracleAddress, index);
    }
    if (initialized) return (index, timestamp);

    (, timestamp) = timepointMetadata(oracleAddress, 0);
    return (0, timestamp);
  }

  /// @notice Gets information about whether the oracle has been initialized
  function isInitialized(address oracleAddress) internal view returns (bool result) {
    (result, ) = timepointMetadata(oracleAddress, 0);
    return result;
  }

  /// @notice Fetches the index of last available record (most recent) in oracle
  function latestIndex(address oracle) internal view returns (uint16) {
    return (IVolatilityOracle(oracle).timepointIndex());
  }

  /// @notice Fetches the metadata of record in oracle
  /// @param oracleAddress The address of oracle
  /// @param index The index of record in oracle
  /// @return initialized Whether or not the timepoint is initialized
  /// @return timestamp The timestamp of timepoint
  function timepointMetadata(address oracleAddress, uint16 index) internal view returns (bool initialized, uint32 timestamp) {
    (initialized, timestamp, , , , , ) = IVolatilityOracle(oracleAddress).timepoints(index);
  }

  /// @notice Checks if the oracle is currently connected to the pool
  /// @param oracleAddress The address of oracle
  /// @param oracleAddress The address of the pool
  /// @return connected Whether or not the oracle is connected
  function isOracleConnectedToPool(address oracleAddress, address poolAddress) internal view returns (bool connected) {
    IAlgebraPool pool = IAlgebraPool(poolAddress);
    if (oracleAddress == pool.plugin()) {
      (, , , uint8 pluginConfig, , ) = pool.globalState();
      connected = Plugins.hasFlag(pluginConfig, Plugins.BEFORE_SWAP_FLAG);
    }
  }
}
