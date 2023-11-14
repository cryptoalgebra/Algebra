// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title Algebra base plugin V1 oracle frontend
/// @notice Provides data from oracle corresponding pool
/// @dev These functions are not very gas efficient and it is better not to use them on-chain
interface IAlgebraOracleV1TWAP {
  /// @notice The address of the factory of plugins that are used as oracles by this contract
  function pluginFactory() external view returns (address);

  /// @notice Given a tick and a token amount, calculates the amount of token received in exchange
  /// @dev Should not be used as quote for swap
  /// @param tick Tick value used to calculate the quote
  /// @param baseAmount Amount of token to be converted
  /// @param baseToken Address of an ERC20 token contract used as the baseAmount denomination
  /// @param quoteToken Address of an ERC20 token contract used as the quoteAmount denomination
  /// @return quoteAmount Amount of quoteToken received for baseAmount of baseToken
  function getQuoteAtTick(int24 tick, uint128 baseAmount, address baseToken, address quoteToken) external pure returns (uint256 quoteAmount);

  /// @notice Fetches time-weighted average tick using Algebra VolatilityOracle
  /// @dev Oracle may stop receiving data from the pool (be disconnected). For that reason it is important
  /// not to rely on the absolute accuracy and availability at any time of this oracle.
  /// It is recommended to check the latest available timestamp using the `latestTimestamp` method and don't use the data if the last entry is too old
  /// @param pool The address of Algebra Integral pool
  /// @param period Number of seconds in the past to start calculating time-weighted average
  /// @return timeWeightedAverageTick The time-weighted average tick from (block.timestamp - period) to block.timestamp
  /// @return isConnected Is oracle currently connected to the pool. If disconnected data can be obsolete
  function getAverageTick(address pool, uint32 period) external view returns (int24 timeWeightedAverageTick, bool isConnected);

  /// @notice Returns the last timestamp written in the oracle
  function latestTimestamp(address pool) external view returns (uint32);

  /// @notice Returns the oldest timestamp available in the oracle
  function oldestTimestamp(address pool) external view returns (uint32 _oldestTimestamp);

  /// @notice Returns the index of last record written in the oracle
  function latestIndex(address pool) external view returns (uint16);

  /// @notice Returns the index of oldest record available in the oracle
  function oldestIndex(address pool) external view returns (uint16);

  /// @notice Whether or not the oracle is connected to the liquidity pool
  /// @dev Oracle should not be used if disconnected from pool
  function isOracleConnected(address pool) external view returns (bool connected);
}
