// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../../libraries/TickMath.sol';
import '../../libraries/Constants.sol';

contract TickMathEchidnaTest {
  // uniqueness and increasing order
  function checkGetSqrtRatioAtTickInvariants(int24 tick) external pure {
    unchecked {
      uint160 ratio = TickMath.getSqrtRatioAtTick(tick);
      assert(TickMath.getSqrtRatioAtTick(tick - 1) < ratio && ratio < TickMath.getSqrtRatioAtTick(tick + 1));
      assert(ratio >= TickMath.MIN_SQRT_RATIO);
      assert(ratio <= TickMath.MAX_SQRT_RATIO);
    }
  }

  // the ratio is always between the returned tick and the returned tick+1
  function checkGetTickAtSqrtRatioInvariants(uint160 ratio) external pure {
    unchecked {
      int24 tick = TickMath.getTickAtSqrtRatio(ratio);
      assert(ratio >= TickMath.getSqrtRatioAtTick(tick) && ratio < TickMath.getSqrtRatioAtTick(tick + 1));
      assert(tick >= TickMath.MIN_TICK);
      assert(tick < TickMath.MAX_TICK);
    }
  }

  // the ratio is always between the returned tick and the returned tick+1
  function checkTickChangeEstimation(int24 tick, int160 priceDelta) external pure {
    tick = _boundTick(tick);

    uint160 priceAtTick = TickMath.getSqrtRatioAtTick(tick);

    uint160 price = priceDelta >= 0 ? (priceAtTick + uint160(priceDelta)) : (priceAtTick - uint160(-priceDelta));

    require(price >= TickMath.MIN_SQRT_RATIO);
    require(price <= TickMath.MAX_SQRT_RATIO);

    unchecked {
      bool tickChangeTest;

      if (price == priceAtTick) tickChangeTest = false;
      else if (price > priceAtTick) {
        tickChangeTest = price >= ((uint256(priceAtTick) * Constants.TICK_SQRT) / Constants.TICK_SQRT_DENOMINATOR);
      } else {
        tickChangeTest = true;
      }

      assert(tickChangeTest != (TickMath.getTickAtSqrtRatio(uint160(price)) == tick));
    }
  }

  function _boundTick(int24 tick) private pure returns (int24) {
    if (tick < TickMath.MIN_TICK) tick = TickMath.MIN_TICK;
    if (tick > TickMath.MAX_TICK) tick = TickMath.MAX_TICK;
    return tick;
  }
}
