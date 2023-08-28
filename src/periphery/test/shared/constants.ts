export const MaxUint128 = 2n ** 128n - 1n;

export enum FeeAmount {
  ONE = 100,
  LOW = 500,
  MEDIUM = 500,
  HIGH = 500,
}

export const TICK_SPACINGS: { [amount in FeeAmount]: number } = {
  [FeeAmount.ONE]: 1,
  [FeeAmount.LOW]: 60,
  [FeeAmount.MEDIUM]: 60,
  [FeeAmount.HIGH]: 60,
};

// polygon addresses
export const tokenAddresses = {
  DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
  USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  WBTC: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
};

export const tokenRatioSortOrder = {
  NUMERATOR_MOST: 300n,
  NUMERATOR_MORE: 200n,
  NUMERATOR: 100n,
  DENOMINATOR_MOST: -300n,
  DENOMINATOR_MORE: -200n,
  DENOMINATOR: -100n,
};
