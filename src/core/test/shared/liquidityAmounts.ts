import bn from 'bignumber.js';

const Q96 = 2n ** 96n;

function mulDiv(a: bigint, b: bigint, denominator: bigint): bigint {
  return (a * b) / denominator;
}

/// @notice Computes the amount of liquidity received for a given amount of token0 and price range
/// @dev Calculates amount0 * (sqrt(upper) * sqrt(lower)) / (sqrt(upper) - sqrt(lower))
function getLiquidityForAmount0(
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  amount0: bigint
): bigint {
  if (sqrtRatioAX96 > sqrtRatioBX96) {
    [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
  }
  const intermediate = mulDiv(sqrtRatioAX96, sqrtRatioBX96, Q96);
  return mulDiv(amount0, intermediate, sqrtRatioBX96 - sqrtRatioAX96);
}

/// @notice Computes the amount of liquidity received for a given amount of token1 and price range
/// @dev Calculates amount1 / (sqrt(upper) - sqrt(lower))
function getLiquidityForAmount1(
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  amount1: bigint
): bigint {
  if (sqrtRatioAX96 > sqrtRatioBX96) {
    [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
  }
  return mulDiv(amount1, Q96, sqrtRatioBX96 - sqrtRatioAX96);
}

/// @notice Computes the maximum amount of liquidity received for a given amount of token0, token1, the current
/// pool prices and the prices at the tick boundaries
/// @param sqrtRatioX96 A sqrt price representing the current pool prices
/// @param sqrtRatioAX96 A sqrt price representing the first tick boundary
/// @param sqrtRatioBX96 A sqrt price representing the second tick boundary
/// @param amount0 The amount of token0 being sent in
/// @param amount1 The amount of token1 being sent in
/// @return liquidity The maximum amount of liquidity received
export function getLiquidityForAmounts(
  sqrtRatioX96: bigint,
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  amount0: bigint,
  amount1: bigint
): bigint {
  if (sqrtRatioAX96 > sqrtRatioBX96) {
    [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
  }

  let liquidity: bigint;

  if (sqrtRatioX96 <= sqrtRatioAX96) {
    liquidity = getLiquidityForAmount0(sqrtRatioAX96, sqrtRatioBX96, amount0);
  } else if (sqrtRatioX96 < sqrtRatioBX96) {
    const liquidity0 = getLiquidityForAmount0(sqrtRatioX96, sqrtRatioBX96, amount0);
    const liquidity1 = getLiquidityForAmount1(sqrtRatioAX96, sqrtRatioX96, amount1);

    liquidity = liquidity0 < liquidity1 ? liquidity0 : liquidity1;
  } else {
    liquidity = getLiquidityForAmount1(sqrtRatioAX96, sqrtRatioBX96, amount1);
  }

  return liquidity;
}
