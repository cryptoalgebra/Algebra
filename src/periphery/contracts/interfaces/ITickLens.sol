// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.7.5;
pragma abicoder v2;

/// @title Tick Lens
/// @notice Provides functions for fetching chunks of tick data for a pool
/// @dev This avoids the waterfall of fetching the tick bitmap, parsing the bitmap to know which ticks to fetch, and
/// then sending additional multicalls to fetch the tick data
/// Credit to Uniswap Labs under GPL-2.0-or-later license:
/// https://github.com/Uniswap/v3-periphery
interface ITickLens {
    struct PopulatedTick {
        int24 tick;
        int128 liquidityNet;
        uint128 liquidityGross;
    }

    /// @notice Get all the tick data for the populated ticks from a word of the tick bitmap of a pool
    /// @param pool The address of the pool for which to fetch populated tick data
    /// @param tickTableIndex The index of the word in the tick bitmap for which to parse the bitmap and
    /// fetch all the populated ticks
    /// @return populatedTicks An array of tick data for the given word in the tick bitmap
    function getPopulatedTicksInWord(
        address pool,
        int16 tickTableIndex
    ) external view returns (PopulatedTick[] memory populatedTicks);

    /// @notice Get closest initialized ticks around `targetTick`
    /// @param pool The address of the pool for which to fetch populated tick data
    /// @param targetTick The tick around which the nearest ticks will be searched
    /// @return populatedTicks An array of two ticks: before or at `targetTick` and after `targetTick`
    function getClosestActiveTicks(
        address pool,
        int24 targetTick
    ) external view returns (PopulatedTick[2] memory populatedTicks);

    /// @notice Get all the tick data for the `amount` (or less) of populated ticks after `startingTick` (including `startingTick` itself)
    /// @param pool The address of the pool for which to fetch populated tick data
    /// @param startingTick The starting tick index. Must be populated tick
    /// @param amount The maximum amount of ticks requested
    /// @param upperDirection The direction of search. Will fetch 'next' ticks in direction of price increase if true
    /// @return populatedTicks An array of tick data for fetched ticks (`amount` or less)
    function getNextActiveTicks(
        address pool,
        int24 startingTick,
        uint256 amount,
        bool upperDirection
    ) external view returns (PopulatedTick[] memory populatedTicks);
}
