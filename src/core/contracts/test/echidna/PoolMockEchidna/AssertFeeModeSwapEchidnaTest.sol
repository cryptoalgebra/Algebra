// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import './PoolMockEchidna.sol';

/// @notice Checks the properties of a whole swap that a single step cannot see
/// @dev A rounding error that is invisible within one step can compound across ticks into a swap that
/// under-delivers or over-charges
contract AssertFeeModeSwapEchidnaTest is PoolMockEchidna {
  /// @notice An exactOut swap either delivers the requested amount in full or stops because it ran out of room
  function swapExactOutWrapped(bool zeroToOne, uint128 amountOut, uint160 limitSqrtPrice) public {
    require(amountOut > 0);
    limitSqrtPrice = _clampLimit(zeroToOne, limitSqrtPrice);

    (int256 amount0, int256 amount1) = IAlgebraPool(this).swap(address(this), zeroToOne, -int256(uint256(amountOut)), limitSqrtPrice, '');

    int256 receivedSigned = zeroToOne ? amount1 : amount0;
    assert(receivedSigned <= 0);
    uint256 received = uint256(-receivedSigned);

    assert(received <= amountOut);
    // stopping before the limit price means there was room left, so the request had to be served in full
    if (globalState.price != limitSqrtPrice) assert(received == amountOut);
  }

  /// @notice An exactIn swap never spends more than it was given, and spends all of it unless it ran out of room
  function swapExactInWrapped(bool zeroToOne, uint128 amountIn, uint160 limitSqrtPrice) public {
    require(amountIn > 0);
    limitSqrtPrice = _clampLimit(zeroToOne, limitSqrtPrice);

    (int256 amount0, int256 amount1) = IAlgebraPool(this).swap(address(this), zeroToOne, int256(uint256(amountIn)), limitSqrtPrice, '');

    int256 spentSigned = zeroToOne ? amount0 : amount1;
    assert(spentSigned >= 0);
    uint256 spent = uint256(spentSigned);

    assert(spent <= amountIn);
    // stopping before the limit price means the whole budget had to be consumed
    if (globalState.price != limitSqrtPrice) assert(spent == amountIn);
  }

  /// @notice A swap only ever moves the accumulator of the fee token
  function swapAndCheckFeeTokenWrapped(bool zeroToOne, int128 amountRequired, uint160 limitSqrtPrice) public {
    require(amountRequired != 0);
    limitSqrtPrice = _clampLimit(zeroToOne, limitSqrtPrice);

    uint8 feeMode = globalState.feeMode;
    (uint256 growth0Before, uint256 growth1Before) = (totalFeeGrowth0Token, totalFeeGrowth1Token);

    IAlgebraPool(this).swap(address(this), zeroToOne, amountRequired, limitSqrtPrice, '');

    bool growth0Changed = totalFeeGrowth0Token != growth0Before;
    bool growth1Changed = totalFeeGrowth1Token != growth1Before;

    if (feeMode == Constants.FEE_MODE_TOKEN0) assert(!growth1Changed);
    else if (feeMode == Constants.FEE_MODE_TOKEN1) assert(!growth0Changed);
    else if (zeroToOne) assert(!growth1Changed);
    else assert(!growth0Changed);
  }

  /// @notice A zero fee rate leaves both accumulators and both pending balances untouched
  function swapWithoutFeeWrapped(bool zeroToOne, int128 amountRequired, uint160 limitSqrtPrice) public {
    require(amountRequired != 0);
    require(globalState.lastFee == 0);
    limitSqrtPrice = _clampLimit(zeroToOne, limitSqrtPrice);

    (uint256 growth0Before, uint256 growth1Before) = (totalFeeGrowth0Token, totalFeeGrowth1Token);
    (uint104 communityPending0Before, uint104 communityPending1Before) = (communityFeePending0, communityFeePending1);

    IAlgebraPool(this).swap(address(this), zeroToOne, amountRequired, limitSqrtPrice, '');

    assert(totalFeeGrowth0Token == growth0Before);
    assert(totalFeeGrowth1Token == growth1Before);
    assert(communityFeePending0 == communityPending0Before);
    assert(communityFeePending1 == communityPending1Before);
  }

  function _clampLimit(bool zeroToOne, uint160 limitSqrtPrice) private view returns (uint160) {
    uint160 currentPrice = globalState.price;
    require(currentPrice > TickMath.MIN_SQRT_RATIO + 1 && currentPrice < TickMath.MAX_SQRT_RATIO - 1);
    if (zeroToOne) {
      if (limitSqrtPrice >= currentPrice) limitSqrtPrice = currentPrice - 1;
      if (limitSqrtPrice <= TickMath.MIN_SQRT_RATIO) limitSqrtPrice = TickMath.MIN_SQRT_RATIO + 1;
    } else {
      if (limitSqrtPrice <= currentPrice) limitSqrtPrice = currentPrice + 1;
      if (limitSqrtPrice >= TickMath.MAX_SQRT_RATIO) limitSqrtPrice = TickMath.MAX_SQRT_RATIO - 1;
    }
    return limitSqrtPrice;
  }
}
