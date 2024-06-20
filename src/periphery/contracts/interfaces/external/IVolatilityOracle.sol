// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title The interface for the Algebra volatility oracle
/// @dev This contract stores timepoints and calculates statistical averages
interface IVolatilityOracle {
    /// @notice Returns the accumulator values as of each time seconds ago from the given time in the array of `secondsAgos`
    /// @dev Reverts if `secondsAgos` > oldest timepoint
    /// @dev `volatilityCumulative` values for timestamps after the last timepoint _should not_ be compared because they may differ due to interpolation errors
    /// @param secondsAgos Each amount of time to look back, in seconds, at which point to return a timepoint
    /// @return tickCumulatives The cumulative tick since the pool was first initialized, as of each `secondsAgo`
    /// @return volatilityCumulatives The cumulative volatility values since the pool was first initialized, as of each `secondsAgo`
    function getTimepoints(
        uint32[] memory secondsAgos
    ) external view returns (int56[] memory tickCumulatives, uint88[] memory volatilityCumulatives);
}
