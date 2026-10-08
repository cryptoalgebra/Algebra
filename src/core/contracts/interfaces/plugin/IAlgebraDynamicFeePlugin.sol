// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title The interface for the Algebra plugin with dynamic fee logic
/// @dev A plugin with a dynamic fee must implement this interface so that the swap fee can be known through the pool
/// The fee should be calculated the same way as in the `beforeSwap` hook, so the same parameters are passed
interface IAlgebraDynamicFeePlugin {
  /// @notice Returns the fee for a swap with the given parameters, as the `beforeSwap` hook would return it
  /// @dev It may differ from the fee of the actual swap if the plugin changes its state in the `beforeSwap` hook
  /// @param sender The address that would call the swap
  /// @param recipient The address to receive the output of the swap
  /// @param zeroToOne The direction of the swap, true for token0 to token1, false for token1 to token0
  /// @param amountRequired The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative)
  /// @param limitSqrtPrice The Q64.96 sqrt price limit
  /// @param withPaymentInAdvance The flag indicating whether the `swapWithPaymentInAdvance` method would be called
  /// @param data Data that would be passed through the callback
  /// @return fee The swap fee in hundredths of a bip, i.e. 1e-6
  function getSwapFee(
    address sender,
    address recipient,
    bool zeroToOne,
    int256 amountRequired,
    uint160 limitSqrtPrice,
    bool withPaymentInAdvance,
    bytes calldata data
  ) external view returns (uint24 fee);
}
