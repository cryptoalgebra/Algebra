// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.8.4 <0.9.0;

/// @title Errors emitted by a pool
/// @notice Contains custom errors emitted by the pool
interface IAlgebraPoolErrors {
  // ####  pool errors  ####

  /// @notice Emitted by the reentrancy guard
  error locked();

  /// @notice Emitted if arithmetic error occurred
  error arithmeticError();

  /// @notice Emitted if an attempt is made to initialize the pool twice
  error alreadyInitialized();

  /// @notice Emitted if 0 is passed as amountRequired to swap function
  error zeroAmountRequired();

  /// @notice Emitted if invalid amount is passed as amountRequired to swapSupportingFeeOnInputTokens function
  error invalidAmountRequired();

  /// @notice Emitted if the pool received fewer tokens than it should have
  error insufficientInputAmount();
  /// @notice Emitted if the pool received fewer tokens than it should have to mint calculated actual liquidity
  error insufficientAmountReceivedAtMint();

  /// @notice Emitted if there was an attempt to mint zero liquidity
  error zeroLiquidityDesired();
  /// @notice Emitted if actual amount of liquidity is zero (due to insufficient amount of tokens received)
  error zeroLiquidityActual();

  /// @notice Emitted if the pool received fewer tokens{0,1} after flash than it should have
  error flashInsufficientPaid0();
  error flashInsufficientPaid1();

  /// @notice Emitted if limitSqrtPrice param is incorrect
  error invalidLimitSqrtPrice();

  /// @notice Tick must be divisible by tickspacing
  error tickIsNotSpaced();

  /// @notice Emitted if a method is called that is accessible only to the factory owner or dedicated role
  error notAllowed();
  /// @notice Emitted if a method is called that is accessible only to the farming
  error onlyFarming();

  error invalidNewTickSpacing();
  error invalidNewCommunityFee();

  // ####  LimitOrder errors  ####
  /// @notice Emitted if tick is too low/high for limit order
  error invalidTickForLimitOrder();
  /// @notice Emitted if amount is too high for limit order
  error invalidAmountForLimitOrder();

  // ####  LiquidityMath errors  ####
  /// @notice Emitted if liquidity underflows
  error liquiditySub();
  /// @notice Emitted if liquidity overflows
  error liquidityAdd();

  // ####  TickManagement errors  ####
  error topTickLowerThanBottomTick();
  error bottomTickLowerThanMIN();
  error topTickAboveMAX();
  error liquidityOverflow();
  error tickIsNotInitialized();
  error tickInvalidLinks();

  // ####  SafeTransfer errors  ####
  error transferFailed();

  // ####  TickMath errors  ####
  error tickOutOfRange();
  error priceOutOfRange();
}
