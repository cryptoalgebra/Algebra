// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.17;

import '../libraries/DataStorageLibrary.sol';

contract DataStorageTest {
    function consult(address pool, uint32 period) public view returns (int24 timeWeightedAverageTick) {
        timeWeightedAverageTick = DataStorageLibrary.consult(pool, period);
    }

    function getQuoteAtTick(
        int24 tick,
        uint128 baseAmount,
        address baseToken,
        address quoteToken
    ) public pure returns (uint256 quoteAmount) {
        quoteAmount = DataStorageLibrary.getQuoteAtTick(tick, baseAmount, baseToken, quoteToken);
    }

    // For gas snapshot test
    function getGasCostOfConsult(address pool, uint32 period) public view returns (uint256) {
        uint256 gasBefore = gasleft();
        DataStorageLibrary.consult(pool, period);
        return gasBefore - gasleft();
    }

    function getGasCostOfGetQuoteAtTick(
        int24 tick,
        uint128 baseAmount,
        address baseToken,
        address quoteToken
    ) public view returns (uint256) {
        uint256 gasBefore = gasleft();
        DataStorageLibrary.getQuoteAtTick(tick, baseAmount, baseToken, quoteToken);
        return gasBefore - gasleft();
    }
}
