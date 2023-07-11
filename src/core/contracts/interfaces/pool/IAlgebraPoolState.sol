// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title Pool state that can change
/// @dev Credit to Uniswap Labs under GPL-2.0-or-later license:
/// https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces
interface IAlgebraPoolState {
  /// @notice The globalState structure in the pool stores many values but requires only one slot
  /// and is exposed as a single method to save gas when accessed externally.
  /// @return price The current price of the pool as a sqrt(dToken1/dToken0) Q64.96 value
  /// @return tick The current tick of the pool, i.e. according to the last tick transition that was run
  /// This value may not always be equal to SqrtTickMath.getTickAtSqrtRatio(price) if the price is on a tick boundary
  /// @return fee The last known pool fee value in hundredths of a bip, i.e. 1e-6
  /// @return pluginConfig The current plugin config. Each bit of the config is responsible for enabling/disabling the hooks
  /// The last bit indicates whether the plugin contains dynamic fees logic
  /// @return communityFee The community fee percentage of the swap fee in thousandths (1e-3)
  /// @return unlocked Whether the pool is currently locked to reentrancy
  function globalState() external view returns (uint160 price, int24 tick, uint16 fee, uint8 pluginConfig, uint16 communityFee, bool unlocked);

  /// @notice Look up information about a specific tick in the pool
  /// @param tick The tick to look up
  /// @return liquidityTotal The total amount of position liquidity that uses the pool either as tick lower or tick upper
  /// @return liquidityDelta How much liquidity changes when the pool price crosses the tick
  /// @return prevTick The previous tick in tick list
  /// @return nextTick The next tick in tick list
  /// @return outerFeeGrowth0Token The fee growth on the other side of the tick from the current tick in token0
  /// @return outerFeeGrowth1Token The fee growth on the other side of the tick from the current tick in token1
  /// In addition, these values are only relative and must be used only in comparison to previous snapshots for
  /// a specific position.
  function ticks(
    int24 tick
  )
    external
    view
    returns (
      uint256 liquidityTotal,
      int128 liquidityDelta,
      int24 prevTick,
      int24 nextTick,
      uint256 outerFeeGrowth0Token,
      uint256 outerFeeGrowth1Token
    );

  /// @notice The timestamp of the last sending of tokens to community vault
  /// @return The timestamp truncated to 32 bits
  function communityFeeLastTimestamp() external view returns (uint32);

  /// @notice The amounts of token0 and token1 that will be sent to the vault
  /// @dev Will be sent COMMUNITY_FEE_TRANSFER_FREQUENCY after communityFeeLastTimestamp
  /// @return communityFeePending0 The amount of token0 that will be sent to the vault
  /// @return communityFeePending1 The amount of token1 that will be sent to the vault
  function getCommunityFeePending() external view returns (uint128 communityFeePending0, uint128 communityFeePending1);

  /// @notice Returns the address of currently used plugin
  /// @dev The plugin is subject to change
  /// @return pluginAddress The address of currently used plugin
  function plugin() external view returns (address pluginAddress);

  /// @notice Returns 256 packed tick initialized boolean values. See TickTree for more information
  /// @param wordPosition Index of 256-bits word with ticks
  /// @return The 256-bits word with packed ticks info
  function tickTable(int16 wordPosition) external view returns (uint256);

  /// @notice The fee growth as a Q128.128 fees of token0 collected per unit of liquidity for the entire life of the pool
  /// @dev This value can overflow the uint256
  /// @return The fee growth accumulator for token0
  function totalFeeGrowth0Token() external view returns (uint256);

  /// @notice The fee growth as a Q128.128 fees of token1 collected per unit of liquidity for the entire life of the pool
  /// @dev This value can overflow the uint256
  /// @return The fee growth accumulator for token1
  function totalFeeGrowth1Token() external view returns (uint256);

  /// @notice The current pool fee value
  /// @dev In case dynamic fee is enabled in the pool, this method will call the plugin to get the current fee.
  /// If the plugin implements complex fee logic, this method may return an incorrect value or revert.
  /// In this case, see the plugin implementation and related documentation.
  /// @return currentFee The current pool fee value in hundredths of a bip, i.e. 1e-6
  function fee() external view returns (uint16 currentFee);

  /// @notice The tracked token0 and token1 reserves of pool
  /// @dev If at any time the real balance is larger, the excess will be transferred to liquidity providers as additional fee.
  /// If the balance exceeds uint128, the excess will be sent to the communityVault.
  /// @return reserve0 The last known reserve of token0
  /// @return reserve1 The last known reserve of token1
  function getReserves() external view returns (uint128 reserve0, uint128 reserve1);

  /// @notice Returns the information about a position by the position's key
  /// @param key The position's key is a packed concatenation of the owner address, bottomTick and topTick indexes
  /// @return liquidity The amount of liquidity in the position
  /// @return innerFeeGrowth0Token Fee growth of token0 inside the tick range as of the last mint/burn/poke
  /// @return innerFeeGrowth1Token Fee growth of token1 inside the tick range as of the last mint/burn/poke
  /// @return fees0 The computed amount of token0 owed to the position as of the last mint/burn/poke
  /// @return fees1 The computed amount of token1 owed to the position as of the last mint/burn/poke
  function positions(
    bytes32 key
  ) external view returns (uint256 liquidity, uint256 innerFeeGrowth0Token, uint256 innerFeeGrowth1Token, uint128 fees0, uint128 fees1);

  /// @notice The currently in range liquidity available to the pool
  /// @dev This value has no relationship to the total liquidity across all ticks.
  /// Returned value cannot exceed type(uint128).max
  /// @return The current in range liquidity
  function liquidity() external view returns (uint128);

  /// @notice The current tick spacing
  /// @dev Ticks can only be initialized by new mints at multiples of this value
  /// e.g.: a tickSpacing of 60 means ticks can be initialized every 60th tick, i.e., ..., -120, -60, 0, 60, 120, ...
  /// However, tickspacing can be changed after the ticks have been initialized.
  /// This value is an int24 to avoid casting even though it is always positive.
  /// @return The current tick spacing
  function tickSpacing() external view returns (int24);

  /// @notice The previous initialized tick before (or at) current global tick
  /// @return The previous initialized tick
  function prevTickGlobal() external view returns (int24);

  /// @notice The next initialized tick after current global tick
  /// @return The next initialized tick
  function nextTickGlobal() external view returns (int24);
}
