// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../../libraries/PriceMovementMath.sol';
import '../../libraries/TickMath.sol';

contract PriceMovementMathEchidnaTest {
  uint256 private constant DENOMINATOR = 1e6;

  /// @dev A step result in terms that do not depend on which token the fee is taken in
  struct StepResult {
    uint160 sqrtQ;
    uint256 amountIn;
    uint256 amountOut;
    uint256 feeAmount;
    uint256 paid; // what the trader gives up, in the input token
    uint256 received; // what the trader gets, in the output token, net of the fee
    uint256 grossFee; // the amount the fee is a share of, in the fee token
    uint256 netFee; // the same amount without the fee
  }

  function checkMovePriceTowardsTargetInvariants(
    uint160 sqrtPriceRaw,
    uint160 sqrtPriceTargetRaw,
    uint128 liquidity,
    int256 amountRemaining,
    uint24 feePips
  ) external pure {
    checkMovePriceTowardsTargetInvariantsWithFeeMode(true, sqrtPriceRaw, sqrtPriceTargetRaw, liquidity, amountRemaining, feePips);
  }

  function checkMovePriceTowardsTargetInvariantsFeeOnOutput(
    uint160 sqrtPriceRaw,
    uint160 sqrtPriceTargetRaw,
    uint128 liquidity,
    int256 amountRemaining,
    uint24 feePips
  ) external pure {
    checkMovePriceTowardsTargetInvariantsWithFeeMode(false, sqrtPriceRaw, sqrtPriceTargetRaw, liquidity, amountRemaining, feePips);
  }

  function checkMovePriceTowardsTargetInvariantsWithFeeMode(
    bool feeOnInput,
    uint160 sqrtPriceRaw,
    uint160 sqrtPriceTargetRaw,
    uint128 liquidity,
    int256 amountRemaining,
    uint24 feePips
  ) public pure {
    require(sqrtPriceRaw > 0);
    require(sqrtPriceTargetRaw > 0);
    feePips = feePips % 1_000_000; // folded rather than required: a raw draw is in range only six percent of the time

    StepResult memory r = _run(feeOnInput, sqrtPriceRaw, sqrtPriceTargetRaw, liquidity, amountRemaining, feePips);

    unchecked {
      // I0: the pair of amounts on the fee side never overflows when recombined
      assert(r.amountIn <= type(uint256).max - r.feeAmount);
      assert(r.amountOut <= type(uint256).max - r.feeAmount);

      // I1: the specified side is never exceeded
      if (amountRemaining < 0) assert(r.received <= uint256(-amountRemaining));
      else assert(r.paid <= uint256(amountRemaining));

      // I2: if the target was not reached, the specified side has to be consumed in full
      if (r.sqrtQ != sqrtPriceTargetRaw) {
        if (amountRemaining < 0) assert(r.received == uint256(-amountRemaining));
        else assert(r.paid == uint256(amountRemaining));
      }

      // I3: the price never moves past the target, and never in the wrong direction
      if (sqrtPriceTargetRaw <= sqrtPriceRaw) {
        assert(r.sqrtQ <= sqrtPriceRaw);
        assert(r.sqrtQ >= sqrtPriceTargetRaw);
      } else {
        assert(r.sqrtQ >= sqrtPriceRaw);
        assert(r.sqrtQ <= sqrtPriceTargetRaw);
      }

      // I4: a step that cannot move the price does nothing at all
      if (sqrtPriceRaw == sqrtPriceTargetRaw) {
        assert(r.amountIn == 0);
        assert(r.amountOut == 0);
        assert(r.feeAmount == 0);
        assert(r.sqrtQ == sqrtPriceTargetRaw);
      }

      // I5: the fee never exceeds its nominal share. Exception: an exactIn step with the fee on the input that
      // stops short of the target absorbs the rounding remainder and may legitimately exceed that share
      bool feeAbsorbsRemainder = feeOnInput && amountRemaining >= 0 && r.sqrtQ != sqrtPriceTargetRaw;
      if (!feeAbsorbsRemainder) assert(r.feeAmount <= FullMath.mulDivRoundingUp(r.grossFee, feePips, DENOMINATOR));

      // I6: the fee is never charged on nothing, and a zero rate yields no fee outside the dust absorbing branch
      if (r.feeAmount > 0) assert(r.grossFee > 0);
      if (feePips == 0 && !feeAbsorbsRemainder) assert(r.feeAmount == 0);
    }
  }

  /// @notice Both fee modes have to agree whenever the fee itself is zero
  /// @dev Compares what the trader gives and gets, not the raw amounts: the fee on the input books the rounding
  /// remainder as a fee even at a zero rate, so the split differs while `paid` does not
  function checkFeeModesAgreeWithoutFee(
    uint160 sqrtPriceRaw,
    uint160 sqrtPriceTargetRaw,
    uint128 liquidity,
    int256 amountRemaining
  ) external pure {
    _requireReachablePrices(sqrtPriceRaw, sqrtPriceTargetRaw);

    StepResult memory onInput = _run(true, sqrtPriceRaw, sqrtPriceTargetRaw, liquidity, amountRemaining, 0);
    StepResult memory onOutput = _run(false, sqrtPriceRaw, sqrtPriceTargetRaw, liquidity, amountRemaining, 0);

    assert(onInput.sqrtQ == onOutput.sqrtQ);
    assert(onInput.paid == onOutput.paid);
    assert(onInput.received == onOutput.received);
    assert(onOutput.feeAmount == 0);
  }

  /// @notice On an exactIn swap, charging the fee on the output is never better for the trader
  /// @dev Follows from the concavity of the curve: `g((1-f)x) >= (1-f)g(x)`.
  /// There is deliberately no exactOut counterpart: the input needed for an output is convex, so both variants
  /// are bounded below by the same quantity and the ordering is decided by rounding. See the unit tests
  function checkFeeOnOutputIsNeverCheaperForTrader(
    uint160 sqrtPriceRaw,
    uint160 sqrtPriceTargetRaw,
    uint128 liquidity,
    int256 amountRemaining,
    uint24 feePips
  ) external pure {
    _requireReachablePrices(sqrtPriceRaw, sqrtPriceTargetRaw);
    feePips = feePips % 1_000_000; // folded rather than required: a raw draw is in range only six percent of the time
    require(amountRemaining >= 0);

    StepResult memory onInput = _run(true, sqrtPriceRaw, sqrtPriceTargetRaw, liquidity, amountRemaining, feePips);
    StepResult memory onOutput = _run(false, sqrtPriceRaw, sqrtPriceTargetRaw, liquidity, amountRemaining, feePips);

    // a budget the input side rounds entirely into the fee never reaches the curve, and concavity says nothing there
    require(onInput.amountIn > 0);

    // over a price move this small the curve is linear to within the rounding of the delta helpers: the concavity
    // gap goes to zero and the ordering is left to rounding, which flips it either way
    uint256 priceMove = sqrtPriceTargetRaw <= sqrtPriceRaw ? sqrtPriceRaw - onInput.sqrtQ : onInput.sqrtQ - sqrtPriceRaw;
    require(priceMove != 0 && priceMove * 1e9 >= sqrtPriceRaw);

    // the input side rounds its fee up and loses under one wei of curve input, which at low liquidity can be worth
    // several wei of output. So it is compared with the smallest budget that puts one wei more onto the curve
    uint256 afterFee = FullMath.mulDiv(uint256(amountRemaining), DENOMINATOR - feePips, DENOMINATOR);
    uint256 budgetPlusOne = FullMath.mulDivRoundingUp(afterFee + 1, DENOMINATOR, DENOMINATOR - feePips);
    require(budgetPlusOne <= uint256(type(int256).max));
    StepResult memory onInputPlusOne = _run(true, sqrtPriceRaw, sqrtPriceTargetRaw, liquidity, int256(budgetPlusOne), feePips);

    assert(onOutput.received <= onInputPlusOne.received);
    assert(onOutput.amountIn >= onInput.amountIn); // and it puts at least as much of the budget onto the curve
  }

  /// @notice The price only moves as far as the tokens that reached the curve justify
  /// @dev Keeps the pool solvent when the fee does not come from the input side
  function checkPriceMovementIsBackedByInput(
    bool feeOnInput,
    uint160 sqrtPriceRaw,
    uint160 sqrtPriceTargetRaw,
    uint128 liquidity,
    int256 amountRemaining,
    uint24 feePips
  ) external pure {
    require(sqrtPriceRaw > 0);
    require(sqrtPriceTargetRaw > 0);
    feePips = feePips % 1_000_000; // folded rather than required: a raw draw is in range only six percent of the time
    require(liquidity > 0);

    StepResult memory r = _run(feeOnInput, sqrtPriceRaw, sqrtPriceTargetRaw, liquidity, amountRemaining, feePips);
    if (r.sqrtQ == sqrtPriceRaw) return;

    bool zeroToOne = sqrtPriceTargetRaw <= sqrtPriceRaw;
    uint256 inputForPriceMove = zeroToOne
      ? PriceMovementMath.getInputTokenDelta01(r.sqrtQ, sqrtPriceRaw, liquidity)
      : PriceMovementMath.getInputTokenDelta10(r.sqrtQ, sqrtPriceRaw, liquidity);

    assert(inputForPriceMove <= r.amountIn); // never credits more price movement than it was paid for

    uint256 outputForPriceMove = zeroToOne
      ? PriceMovementMath.getOutputTokenDelta01(r.sqrtQ, sqrtPriceRaw, liquidity)
      : PriceMovementMath.getOutputTokenDelta10(r.sqrtQ, sqrtPriceRaw, liquidity);

    // never hands out more than the price movement produced, what it keeps back is the fee
    assert(r.received <= outputForPriceMove);
    if (!feeOnInput) assert(r.received + r.feeAmount <= outputForPriceMove);
  }

  /// @dev Outside the reachable range the deltas are degenerate and any ordering is decided by rounding alone
  function _requireReachablePrices(uint160 sqrtPriceRaw, uint160 sqrtPriceTargetRaw) private pure {
    require(sqrtPriceRaw >= TickMath.MIN_SQRT_RATIO && sqrtPriceRaw <= TickMath.MAX_SQRT_RATIO);
    require(sqrtPriceTargetRaw >= TickMath.MIN_SQRT_RATIO && sqrtPriceTargetRaw <= TickMath.MAX_SQRT_RATIO);
  }

  function _run(
    bool feeOnInput,
    uint160 sqrtPriceRaw,
    uint160 sqrtPriceTargetRaw,
    uint128 liquidity,
    int256 amountRemaining,
    uint24 feePips
  ) private pure returns (StepResult memory r) {
    (r.sqrtQ, r.amountIn, r.amountOut, r.feeAmount) = PriceMovementMath.movePriceTowardsTarget(
      feeOnInput,
      sqrtPriceTargetRaw <= sqrtPriceRaw,
      sqrtPriceRaw,
      sqrtPriceTargetRaw,
      liquidity,
      amountRemaining,
      feePips
    );

    unchecked {
      // `amountOut` is already net of the fee when it is taken on the output side, `amountIn` never includes it
      r.paid = feeOnInput ? r.amountIn + r.feeAmount : r.amountIn;
      r.received = r.amountOut;
      r.grossFee = feeOnInput ? r.paid : r.amountOut + r.feeAmount;
      r.netFee = feeOnInput ? r.amountIn : r.amountOut;
    }
  }

  function checkGetNewPriceAfterInputInvariantZtO(uint160 price, uint128 liquidity, uint256 amount) external pure {
    uint160 newPrice = PriceMovementMath.getNewPriceAfterInput(price, liquidity, amount, true);
    uint256 requiredTokenAmount = PriceMovementMath.getInputTokenDelta01(newPrice, price, liquidity);
    assert(requiredTokenAmount <= amount);
  }

  function checkGetNewPriceAfterInputInvariantOtZ(uint160 price, uint128 liquidity, uint256 amount) external pure {
    uint160 newPrice = PriceMovementMath.getNewPriceAfterInput(price, liquidity, amount, false);
    uint256 requiredTokenAmount = PriceMovementMath.getInputTokenDelta10(newPrice, price, liquidity);
    assert(requiredTokenAmount <= amount);
  }
}
