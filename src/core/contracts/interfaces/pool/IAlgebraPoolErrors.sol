// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.4;

/// @title Errors emitted by a pool
/// @notice Contains custom errors emitted by the pool
/// @dev Custom errors are separated from the common pool interface for compatibility with older versions of Solidity
interface IAlgebraPoolErrors {
  // ####  pool errors  ####

  /// @notice Emitted by the reentrancy guard
  error locked();

  /// @notice Emitted if arithmetic error occurred
  error arithmeticError();

  /// @notice Emitted if an attempt is made to initialize the pool twice
  error alreadyInitialized();

  /// @notice Emitted if an attempt is made to mint or swap in uninitialized pool
  error notInitialized();

  /// @notice Emitted if 0 is passed as amountRequired to swap function
  error zeroAmountRequired();

  /// @notice Emitted if invalid amount is passed as amountRequired to swap function
  error invalidAmountRequired();

  /// @notice Emitted if plugin fee param greater than fee/override fee
  error incorrectPluginFee();

  /// @notice Emitted if the pool received fewer tokens than it should have
  error insufficientInputAmount();

  /// @notice Emitted if there was an attempt to mint zero liquidity
  error zeroLiquidityDesired();
  /// @notice Emitted if actual amount of liquidity is zero (due to insufficient amount of tokens received)
  error zeroLiquidityActual();

  /// @notice Emitted if the pool received fewer tokens0 after flash than it should have
  error flashInsufficientPaid0();
  /// @notice Emitted if the pool received fewer tokens1 after flash than it should have
  error flashInsufficientPaid1();

  /// @notice Emitted if limitSqrtPrice param is incorrect
  error invalidLimitSqrtPrice();

  /// @notice Tick must be divisible by tickspacing
  error tickIsNotSpaced();

  /// @notice Emitted if a method is called that is accessible only to the factory owner or dedicated role
  error notAllowed();

  /// @notice Emitted if new tick spacing exceeds max allowed value
  error invalidNewTickSpacing();
  /// @notice Emitted if new community fee exceeds max allowed value
  error invalidNewCommunityFee();

  /// @notice Emitted if an attempt is made to manually change the fee value, but dynamic fee is enabled
  error dynamicFeeActive();
  /// @notice Emitted if an attempt is made by plugin to change the fee value, but dynamic fee is disabled
  error dynamicFeeDisabled();
  /// @notice Emitted if an attempt is made to change the plugin configuration, but the plugin is not connected
  error pluginIsNotConnected();
  /// @notice Emitted if a plugin returns invalid selector after hook call
  /// @param expectedSelector The expected selector
  error invalidHookResponse(bytes4 expectedSelector);

  // ####  LiquidityMath errors  ####

  /// @notice Emitted if liquidity underflows
  error liquiditySub();
  /// @notice Emitted if liquidity overflows
  error liquidityAdd();

  // ####  TickManagement errors  ####

  /// @notice Emitted if the topTick param not greater then the bottomTick param
  error topTickLowerOrEqBottomTick();
  /// @notice Emitted if the bottomTick param is lower than min allowed value
  error bottomTickLowerThanMIN();
  /// @notice Emitted if the topTick param is greater than max allowed value
  error topTickAboveMAX();
  /// @notice Emitted if the liquidity value associated with the tick exceeds MAX_LIQUIDITY_PER_TICK
  error liquidityOverflow();
  /// @notice Emitted if an attempt is made to interact with an uninitialized tick
  error tickIsNotInitialized();
  /// @notice Emitted if there is an attempt to insert a new tick into the list of ticks with incorrect indexes of the previous and next ticks
  error tickInvalidLinks();

  // ####  SafeTransfer errors  ####

  /// @notice Emitted if token transfer failed internally
  error transferFailed();

  // ####  TickMath errors  ####

  /// @notice Emitted if tick is greater than the maximum or less than the minimum allowed value
  error tickOutOfRange();
  /// @notice Emitted if price is greater than the maximum or less than the minimum allowed value
  error priceOutOfRange();
}
