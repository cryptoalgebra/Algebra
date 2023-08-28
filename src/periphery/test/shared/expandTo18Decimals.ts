export function expandTo18Decimals(n: number): bigint {
  return BigInt(n) * 10n ** 18n;
}
