// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0 <0.9.0;

import '@cryptoalgebra/core/contracts/interfaces/IAlgebraPool.sol';

import '@cryptoalgebra/plugins/contracts/interfaces/IDataStorageOperator.sol';

/// @title Weighted DataStorage library
/// @notice Provides functions to integrate with dataStorage of the pool
library WeightedDataStorageLibrary {
    /// @notice The result of observating a pool across a certain period
    struct PeriodTimepoint {
        int24 arithmeticMeanTick;
        uint128 harmonicMeanLiquidity;
    }

    /// @notice Fetches a time-weighted timepoint for a given Algebra pool
    /// @param pool Address of the pool that we want to getTimepoints
    /// @param period Number of seconds in the past to start calculating the time-weighted timepoint
    /// @return timepoint An timepoint that has been time-weighted from (block.timestamp - period) to block.timestamp
    function consult(address pool, uint32 period) internal view returns (PeriodTimepoint memory timepoint) {
        require(period != 0, 'BP');

        uint192 periodX160 = uint192(period) * type(uint160).max;

        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = period;
        secondsAgos[1] = 0;

        IDataStorageOperator dsOperator = IDataStorageOperator(IAlgebraPool(pool).plugin());

        (int56[] memory tickCumulatives, uint112[] memory secondsPerLiquidityCumulativeX128s) = dsOperator
            .getTimepoints(secondsAgos);
        int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
        uint160 secondsPerLiquidityCumulativesDelta = uint160(secondsPerLiquidityCumulativeX128s[1]) -
            uint160(secondsPerLiquidityCumulativeX128s[0]);

        timepoint.arithmeticMeanTick = int24(tickCumulativesDelta / int56(uint56(period)));
        // Always round to negative infinity
        if (tickCumulativesDelta < 0 && (tickCumulativesDelta % int56(uint56(period)) != 0))
            timepoint.arithmeticMeanTick--;

        // We are shifting the liquidity delta to ensure that the result doesn't overflow uint128
        timepoint.harmonicMeanLiquidity = uint128(periodX160 / (uint192(secondsPerLiquidityCumulativesDelta) << 32));
    }

    /// @notice Given some time-weighted timepoints, calculates the arithmetic mean tick, weighted by liquidity
    /// @param timepoints A list of time-weighted timepoints
    /// @return arithmeticMeanWeightedTick The arithmetic mean tick, weighted by the timepoints' time-weighted harmonic average liquidity
    /// @dev In most scenarios, each entry of `timepoints` should share the same `period` and underlying `pool` tokens.
    /// If `period` differs across timepoints, the result becomes difficult to interpret and is likely biased/manipulable.
    /// If the underlying `pool` tokens differ across timepoints, extreme care must be taken to ensure that both prices and liquidity values are comparable.
    /// Even if prices are commensurate (e.g. two different USD-stable assets against ETH), liquidity values may not be, as decimals can differ between tokens.
    function getArithmeticMeanTickWeightedByLiquidity(
        PeriodTimepoint[] memory timepoints
    ) internal pure returns (int24 arithmeticMeanWeightedTick) {
        // Accumulates the sum of all timepoints' products between each their own average tick and harmonic average liquidity
        // Each product can be stored in a int160, so it would take approximately 2**96 timepoints to overflow this accumulator
        int256 numerator;

        // Accumulates the sum of the harmonic average liquidities from the given timepoints
        // Each average liquidity can be stored in a uint128, so it will take approximately 2**128 timepoints to overflow this accumulator
        uint256 denominator;

        for (uint256 i; i < timepoints.length; i++) {
            numerator += int256(uint256(timepoints[i].harmonicMeanLiquidity)) * timepoints[i].arithmeticMeanTick;
            denominator += timepoints[i].harmonicMeanLiquidity;
        }

        arithmeticMeanWeightedTick = int24(numerator / int256(denominator));

        // Always round to negative infinity
        if (numerator < 0 && (numerator % int256(denominator) != 0)) arithmeticMeanWeightedTick--;
    }
}
