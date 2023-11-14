// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../libraries/integration/OracleLibrary.sol';

contract OracleLibraryTest {
  function consult(address oracleAddress, uint32 period) public view returns (int24 timeWeightedAverageTick) {
    timeWeightedAverageTick = OracleLibrary.consult(oracleAddress, period);
  }

  function getQuoteAtTick(int24 tick, uint128 baseAmount, address baseToken, address quoteToken) public pure returns (uint256 quoteAmount) {
    quoteAmount = OracleLibrary.getQuoteAtTick(tick, baseAmount, baseToken, quoteToken);
  }

  function lastTimepointMetadata(address oracleAddress) external view returns (uint16 index, uint32 timestamp) {
    return OracleLibrary.lastTimepointMetadata(oracleAddress);
  }

  function oldestTimepointMetadata(address oracleAddress) external view returns (uint16 index, uint32 timestamp) {
    return OracleLibrary.oldestTimepointMetadata(oracleAddress);
  }

  function isInitialized(address oracleAddress) external view returns (bool) {
    return OracleLibrary.isInitialized(oracleAddress);
  }

  // For gas snapshot test
  function getGasCostOfConsult(address oracleAddress, uint32 period) public view returns (uint256) {
    uint256 gasBefore = gasleft();
    OracleLibrary.consult(oracleAddress, period);
    return gasBefore - gasleft();
  }

  function getGasCostOfGetQuoteAtTick(int24 tick, uint128 baseAmount, address baseToken, address quoteToken) public view returns (uint256) {
    uint256 gasBefore = gasleft();
    OracleLibrary.getQuoteAtTick(tick, baseAmount, baseToken, quoteToken);
    return gasBefore - gasleft();
  }

  function isConnected(address oracleAddress, address poolAddress) external view returns (bool) {
    return OracleLibrary.isOracleConnectedToPool(oracleAddress, poolAddress);
  }
}
