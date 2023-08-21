import bn from 'bignumber.js';
import { BigNumberish, AbiCoder, keccak256, getAddress } from 'ethers';

export const MaxUint128 = 2n ** 128n - 1n;

export const MIN_TICK = -887272;
export const MAX_TICK = -MIN_TICK;

export const getMinTick = (tickSpacing: number) => Math.ceil(-887272 / tickSpacing) * tickSpacing;
export const getMaxTick = (tickSpacing: number) => Math.floor(887272 / tickSpacing) * tickSpacing;

export const getMaxLiquidityPerTick = (tickSpacing: number) =>
  (2n ** 128n - 1n) / (BigInt(getMaxTick(tickSpacing) - getMinTick(tickSpacing)) / BigInt(tickSpacing) + 1n);

export const MIN_SQRT_RATIO = BigInt('4295128739');
export const MAX_SQRT_RATIO = BigInt('1461446703485210103287273052203988822378723970342');

export enum FeeAmount {
  LOW = 500,
  MEDIUM = 3000,
  HIGH = 10000,
}

export const PLUGIN_FLAGS = {
  BEFORE_SWAP_FLAG: 1,
  AFTER_SWAP_FLAG: 1 << 1,
  BEFORE_POSITION_MODIFY_FLAG: 1 << 2,
  AFTER_POSITION_MODIFY_FLAG: 1 << 3,
  BEFORE_FLASH_FLAG: 1 << 4,
  AFTER_FLASH_FLAG: 1 << 5,
  AFTER_INIT_FLAG: 1 << 6,
  DYNAMIC_FEE: 1 << 7,
};

export const TICK_SPACINGS: { [amount in FeeAmount]: number } = {
  [FeeAmount.LOW]: 10,
  [FeeAmount.MEDIUM]: 60,
  [FeeAmount.HIGH]: 100,
};

export function expandTo18Decimals(n: number): bigint {
  return BigInt(n) * 10n ** 18n;
}

export function getCreate2Address(factoryAddress: string, [tokenA, tokenB]: [string, string], bytecode: string): string {
  const [token0, token1] = tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];
  const constructorArgumentsEncoded = AbiCoder.defaultAbiCoder().encode(['address', 'address'], [token0, token1]);
  const create2Inputs = [
    '0xff',
    factoryAddress,
    // salt
    keccak256(constructorArgumentsEncoded),
    // init code. bytecode + constructor arguments
    keccak256(bytecode),
  ];
  const sanitizedInputs = `0x${create2Inputs.map((i) => i.slice(2)).join('')}`;
  return getAddress(`0x${keccak256(sanitizedInputs).slice(-40)}`);
}

export function encodeCallback(address: string, paid0?: bigint, paid1?: bigint): string {
  if (paid0) return AbiCoder.defaultAbiCoder().encode(['address', 'uint256', 'uint256'], [address, paid0, paid1]);
  return AbiCoder.defaultAbiCoder().encode(['address'], [address]);
}

bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });

// returns the sqrt price as a 64x96
export function encodePriceSqrt(reserve1: BigNumberish, reserve0: BigNumberish): bigint {
  return BigInt(new bn(reserve1.toString()).div(reserve0.toString()).sqrt().multipliedBy(new bn(2).pow(96)).integerValue(3).toString());
}
