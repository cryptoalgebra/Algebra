// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title Pool state that can change
/// @dev Credit to Uniswap Labs under GPL-2.0-or-later license:
/// https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces
interface IAlgebraPoolState {
  /// @notice The globalState structure in the pool stores many values but requires only one slot
  /// and is exposed as a single method to save gas when accessed externally.
  /// @return price The current price of the pool as a sqrt(dToken1/dToken0) Q64.96 value;
  /// @return tick The current tick of the pool, i.e. according to the last tick transition that was run;
  /// This value may not always be equal to SqrtTickMath.getTickAtSqrtRatio(price) if the price is on a tick boundary;
  /// @return prevInitializedTick The previous initialized tick
  /// @return fee The last pool fee value in hundredths of a bip, i.e. 1e-6
  /// @return timepointIndex The index of the last written timepoint
  /// @return communityFee The community fee percentage of the swap fee in thousandths (1e-3)
  /// @return unlocked Whether the pool is currently locked to reentrancy
  function globalState()
    external
    view
    returns (uint160 price, int24 tick, int24 prevInitializedTick, uint16 fee, uint16 timepointIndex, uint8 communityFee, bool unlocked);

  /// @notice The fee growth as a Q128.128 fees of token0 collected per unit of liquidity for the entire life of the pool
  /// @dev This value can overflow the uint256
  function totalFeeGrowth0Token() external view returns (uint256);

  /// @notice The fee growth as a Q128.128 fees of token1 collected per unit of liquidity for the entire life of the pool
  /// @dev This value can overflow the uint256
  function totalFeeGrowth1Token() external view returns (uint256);

  /// @notice The currently in range liquidity available to the pool
  /// @dev This value has no relationship to the total liquidity across all ticks.
  /// Returned value cannot exceed type(uint128).max
  function liquidity() external view returns (uint128);

  /// @notice The current tick spacing
  /// @dev Ticks can only be used at multiples of this value
  /// e.g.: a tickSpacing of 60 means ticks can be initialized every 60th tick, i.e., ..., -120, -60, 0, 60, 120, ...
  /// This value is an int24 to avoid casting even though it is always positive.
  /// @return The current tick spacing
  function tickSpacing() external view returns (int24);

  /// @notice The current tick spacing for limit orders
  /// @dev Ticks can only be used for limit orders at multiples of this value
  /// This value is an int24 to avoid casting even though it is always positive.
  /// @return The current tick spacing for limit orders
  function tickSpacingLimitOrders() external view returns (int24);

  /// @notice The timestamp of the last sending of tokens to community vault
  function communityFeeLastTimestamp() external view returns (uint32);

  /// @notice The amounts of token0 and token1 that will be sent to the vault
  /// @dev Will be sent COMMUNITY_FEE_TRANSFER_FREQUENCY after communityFeeLastTimestamp
  function getCommunityFeePending() external view returns (uint128 communityFeePending0, uint128 communityFeePending1);

  /// @notice The tracked token0 and token1 reserves of pool
  /// @dev If at any time the real balance is larger, the excess will be transferred to liquidity providers as additional fee.
  /// If the balance exceeds uint128, the excess will be sent to the communityVault.
  function getReserves() external view returns (uint128 reserve0, uint128 reserve1);

  /// @notice The accumulator of seconds per liquidity since the pool was first initialized
  function secondsPerLiquidityCumulative() external view returns (uint160);

  /// @notice Look up information about a specific tick in the pool
  /// @param tick The tick to look up
  /// @return liquidityTotal The total amount of position liquidity that uses the pool either as tick lower or tick upper
  /// @return liquidityDelta How much liquidity changes when the pool price crosses the tick
  /// @return outerFeeGrowth0Token The fee growth on the other side of the tick from the current tick in token0
  /// @return outerFeeGrowth1Token The fee growth on the other side of the tick from the current tick in token1
  /// @return prevTick The previous tick in tick list
  /// @return nextTick The next tick in tick list
  /// @return outerSecondsPerLiquidity The seconds spent per liquidity on the other side of the tick from the current tick
  /// @return outerSecondsSpent The seconds spent on the other side of the tick from the current tick
  /// @return hasLimitOrders Whether there are limit orders on this tick or not
  /// In addition, these values are only relative and must be used only in comparison to previous snapshots for
  /// a specific position.
  function ticks(
    int24 tick
  )
    external
    view
    returns (
      uint128 liquidityTotal,
      int128 liquidityDelta,
      uint256 outerFeeGrowth0Token,
      uint256 outerFeeGrowth1Token,
      int24 prevTick,
      int24 nextTick,
      uint160 outerSecondsPerLiquidity,
      uint32 outerSecondsSpent,
      bool hasLimitOrders
    );

  /// @notice Returns the summary information about a limit orders at tick
  /// @param tick The tick to look up
  /// @return amountToSell The amount of tokens to sell. Has only relative meaning
  /// @return soldAmount The amount of tokens already sold. Has only relative meaning
  /// @return boughtAmount0Cumulative The accumulator of bought tokens0 per amountToSell. Has only relative meaning
  /// @return boughtAmount1Cumulative The accumulator of bought tokens1 per amountToSell. Has only relative meaning
  /// @return initialized Will be true if a limit order was created at least once on this tick
  function limitOrders(
    int24 tick
  )
    external
    view
    returns (uint128 amountToSell, uint128 soldAmount, uint256 boughtAmount0Cumulative, uint256 boughtAmount1Cumulative, bool initialized);

  /// @notice Returns 256 packed tick initialized boolean values. See TickTree for more information
  function tickTable(int16 wordPosition) external view returns (uint256);

  /// @notice Returns the information about a position by the position's key
  /// @param key The position's key is a hash of a preimage composed by the owner, bottomTick and topTick
  /// @return liquidity The amount of liquidity in the position
  /// @return innerFeeGrowth0Token Fee growth of token0 inside the tick range as of the last mint/burn/poke
  /// @return innerFeeGrowth1Token Fee growth of token1 inside the tick range as of the last mint/burn/poke
  /// @return fees0 The computed amount of token0 owed to the position as of the last mint/burn/poke
  /// @return fees1 The computed amount of token1 owed to the position as of the last mint/burn/poke
  function positions(
    bytes32 key
  ) external view returns (uint256 liquidity, uint256 innerFeeGrowth0Token, uint256 innerFeeGrowth1Token, uint128 fees0, uint128 fees1);

  /// @notice Returns the information about active incentive
  /// @dev if there is no active incentive at the moment, incentiveAddress would be equal to address(0)
  /// @return incentiveAddress The address associated with the current active incentive
  function activeIncentive() external view returns (address incentiveAddress);
}
