// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.8.4;

import '../interfaces/external/IVolatilityOracle.sol';

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
}
