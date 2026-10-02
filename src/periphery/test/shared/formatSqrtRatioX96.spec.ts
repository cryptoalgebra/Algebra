import { encodePriceSqrt } from './encodePriceSqrt';
import { expect } from './expect';
import { formatSqrtRatioX96 } from './formatSqrtRatioX96';

describe('#formatSqrtRatioX96', () => {
  it('is correct for ratios of whole numbers', () => {
    const cases: [number, number, string][] = [
      [9_999_999, 10_000_000, '1.0000'],
      [9_999_999, 1, '10000000'],
      [1, 3, '0.33333'],
      [100, 3, '33.333'],
      [1_000_000, 3, '333330'],
    ];
    for (const [amount1, amount0, expected] of cases) {
      expect(formatSqrtRatioX96(encodePriceSqrt(amount1, amount0)), `${amount1}/${amount0}`).to.eq(expected);
    }
  });
  it('1e-18 still prints 5 sig figs', () => {
    expect(formatSqrtRatioX96(encodePriceSqrt(1, 1e18), 18, 18)).to.eq('0.0000000000000000010000');
  });
  it('accounts for decimal differences', () => {
    expect(formatSqrtRatioX96(encodePriceSqrt(1e6, 1e18), 18, 6)).to.eq('1.0000');
  });
  it('accounts for decimal differences in reverse', () => {
    expect(formatSqrtRatioX96(encodePriceSqrt(1e18, 1e6), 6, 18)).to.eq('1.0000');
  });
});
