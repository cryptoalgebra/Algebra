// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.17;
pragma abicoder v2;

import '../libraries/WeightedDataStorageLibrary.sol';

contract WeightedDataStorageTest {
    function consult(address pool, uint32 period)
        public
        view
        returns (WeightedDataStorageLibrary.PeriodTimepoint memory timepoint)
    {
        timepoint = WeightedDataStorageLibrary.consult(pool, period);
    }

    function getArithmeticMeanTickWeightedByLiquidity(WeightedDataStorageLibrary.PeriodTimepoint[] memory timepoints)
        public
        pure
        returns (int24 arithmeticMeanWeightedTick)
    {
        arithmeticMeanWeightedTick = WeightedDataStorageLibrary.getArithmeticMeanTickWeightedByLiquidity(timepoints);
    }
}
