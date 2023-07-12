// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.20;

import '../../libraries/FullMath.sol';
import '../../libraries/TokenDeltaMath.sol';
import '../../libraries/PriceMovementMath.sol';
import '../../libraries/Constants.sol';

contract TokenDeltaMathEchidnaTest {
  function mulDivRoundingUpInvariants(uint256 x, uint256 y, uint256 z) external pure {
    unchecked {
      require(z > 0);
      uint256 notRoundedUp = FullMath.mulDiv(x, y, z);
      uint256 roundedUp = FullMath.mulDivRoundingUp(x, y, z);
      assert(roundedUp >= notRoundedUp);
      assert(roundedUp - notRoundedUp < 2);
      if (roundedUp - notRoundedUp == 1) {
        assert(mulmod(x, y, z) > 0);
      } else {
        assert(mulmod(x, y, z) == 0);
      }
    }
  }

  function getNextSqrtPriceFromInputInvariants(uint160 sqrtP, uint128 liquidity, uint256 amountIn, bool zeroToOne) external pure {
    uint160 sqrtQ = PriceMovementMath.getNewPriceAfterInput(sqrtP, liquidity, amountIn, zeroToOne);

    if (zeroToOne) {
      assert(sqrtQ <= sqrtP);
      assert(amountIn >= TokenDeltaMath.getToken0Delta(sqrtQ, sqrtP, liquidity, true));
    } else {
      assert(sqrtQ >= sqrtP);
      assert(amountIn >= TokenDeltaMath.getToken1Delta(sqrtP, sqrtQ, liquidity, true));
    }
  }

  function getNextSqrtPriceFromOutputInvariants(uint160 sqrtP, uint128 liquidity, uint256 amountOut, bool zeroToOne) external pure {
    uint160 sqrtQ = PriceMovementMath.getNewPriceAfterOutput(sqrtP, liquidity, amountOut, zeroToOne);

    if (zeroToOne) {
      assert(sqrtQ <= sqrtP);
      assert(amountOut <= TokenDeltaMath.getToken1Delta(sqrtQ, sqrtP, liquidity, false));
    } else {
      assert(sqrtQ > 0); // this has to be true, otherwise we need another require
      assert(sqrtQ >= sqrtP);
      assert(amountOut <= TokenDeltaMath.getToken0Delta(sqrtP, sqrtQ, liquidity, false));
    }
  }

  function getNextSqrtPriceFromAmount0RoundingUpInvariants(uint160 sqrtPX96, uint128 liquidity, uint256 amount, bool add) external pure {
    require(sqrtPX96 > 0);
    require(liquidity > 0);

    uint160 sqrtQX96;

    if (add) {
      sqrtQX96 = PriceMovementMath.getNewPriceAfterInput(sqrtPX96, liquidity, amount, true);
    } else {
      sqrtQX96 = PriceMovementMath.getNewPriceAfterOutput(sqrtPX96, liquidity, amount, false);
    }

    if (add) {
      assert(sqrtQX96 <= sqrtPX96);
    } else {
      assert(sqrtQX96 >= sqrtPX96);
    }

    if (amount == 0) {
      assert(sqrtPX96 == sqrtQX96);
    }
  }

  function getNextSqrtPriceFromAmount1RoundingDownInvariants(uint160 sqrtPX96, uint128 liquidity, uint256 amount, bool add) external pure {
    require(sqrtPX96 > 0);
    require(liquidity > 0);
    uint160 sqrtQX96;

    if (add) {
      sqrtQX96 = PriceMovementMath.getNewPriceAfterInput(sqrtPX96, liquidity, amount, false);
    } else {
      sqrtQX96 = PriceMovementMath.getNewPriceAfterOutput(sqrtPX96, liquidity, amount, true);
    }

    if (add) {
      assert(sqrtQX96 >= sqrtPX96);
    } else {
      assert(sqrtQX96 <= sqrtPX96);
    }

    if (amount == 0) {
      assert(sqrtPX96 == sqrtQX96);
    }
  }

  function getToken0DeltaInvariants(uint160 sqrtP, uint160 sqrtQ, uint128 liquidity) external pure {
    require(sqrtP > 0 && sqrtQ > 0);
    if (sqrtP < sqrtQ) (sqrtP, sqrtQ) = (sqrtQ, sqrtP);
    uint256 amount0Down = TokenDeltaMath.getToken0Delta(sqrtQ, sqrtP, liquidity, false);

    uint256 amount0Up = TokenDeltaMath.getToken0Delta(sqrtQ, sqrtP, liquidity, true);

    assert(amount0Down <= amount0Up);
    // diff is 0 or 1
    unchecked {
      assert(amount0Up - amount0Down < 2);
    }
  }

  // ensure that chained division is always equal to the full-precision case for
  // liquidity * (sqrt(P) - sqrt(Q)) / (sqrt(P) * sqrt(Q))
  function getToken0DeltaEquivalency(uint160 sqrtP, uint160 sqrtQ, uint128 liquidity, bool roundUp) external pure {
    require(sqrtP >= sqrtQ);
    require(sqrtP > 0 && sqrtQ > 0);
    unchecked {
      require((sqrtP * sqrtQ) / sqrtP == sqrtQ);
    }

    unchecked {
      uint256 numerator1 = uint256(liquidity) << Constants.RESOLUTION;
      uint256 numerator2 = sqrtP - sqrtQ;
      uint256 denominator = uint256(sqrtP) * sqrtQ;

      uint256 safeResult = roundUp
        ? FullMath.mulDivRoundingUp(numerator1, numerator2, denominator)
        : FullMath.mulDiv(numerator1, numerator2, denominator);
      uint256 fullResult = TokenDeltaMath.getToken0Delta(sqrtQ, sqrtP, liquidity, roundUp);

      assert(safeResult == fullResult);
    }
  }

  function getToken1DeltaInvariants(uint160 sqrtP, uint160 sqrtQ, uint128 liquidity) external pure {
    require(sqrtP > 0 && sqrtQ > 0);
    if (sqrtP > sqrtQ) (sqrtP, sqrtQ) = (sqrtQ, sqrtP);

    uint256 amount1Down = TokenDeltaMath.getToken1Delta(sqrtP, sqrtQ, liquidity, false);

    uint256 amount1Up = TokenDeltaMath.getToken1Delta(sqrtP, sqrtQ, liquidity, true);

    assert(amount1Down <= amount1Up);
    // diff is 0 or 1
    unchecked {
      assert(amount1Up - amount1Down < 2);
    }
  }

  function getToken0DeltaSignedInvariants(uint160 sqrtP, uint160 sqrtQ, int128 liquidity) external pure {
    require(sqrtP > 0 && sqrtQ > 0);

    int256 amount0 = TokenDeltaMath.getToken0Delta(sqrtQ, sqrtP, liquidity);
    if (liquidity < 0) assert(amount0 <= 0);
    if (liquidity > 0) {
      if (sqrtP == sqrtQ) assert(amount0 == 0);
      else assert(amount0 > 0);
    }
    if (liquidity == 0) assert(amount0 == 0);
  }

  function getToken1DeltaSignedInvariants(uint160 sqrtP, uint160 sqrtQ, int128 liquidity) external pure {
    require(sqrtP > 0 && sqrtQ > 0);

    int256 amount1 = TokenDeltaMath.getToken1Delta(sqrtP, sqrtQ, liquidity);
    if (liquidity < 0) assert(amount1 <= 0);
    if (liquidity > 0) {
      if (sqrtP == sqrtQ) assert(amount1 == 0);
      else assert(amount1 > 0);
    }
    if (liquidity == 0) assert(amount1 == 0);
  }

  function getOutOfRangeMintInvariants(uint160 sqrtA, uint160 sqrtB, int128 liquidity) external pure {
    require(sqrtA > 0 && sqrtB > 0);
    require(liquidity > 0);

    int256 amount0 = TokenDeltaMath.getToken0Delta(sqrtA, sqrtB, liquidity);
    int256 amount1 = TokenDeltaMath.getToken1Delta(sqrtA, sqrtB, liquidity);

    if (sqrtA == sqrtB) {
      assert(amount0 == 0);
      assert(amount1 == 0);
    } else {
      assert(amount0 > 0);
      assert(amount1 > 0);
    }
  }

  function getInRangeMintInvariants(uint160 sqrtLower, uint160 sqrtCurrent, uint160 sqrtUpper, int128 liquidity) external pure {
    require(sqrtLower > 0);
    require(sqrtLower < sqrtUpper);
    require(sqrtLower <= sqrtCurrent && sqrtCurrent <= sqrtUpper);
    require(liquidity > 0);

    int256 amount0 = TokenDeltaMath.getToken0Delta(sqrtCurrent, sqrtUpper, liquidity);
    int256 amount1 = TokenDeltaMath.getToken1Delta(sqrtLower, sqrtCurrent, liquidity);

    assert(amount0 > 0 || amount1 > 0);
  }
}
