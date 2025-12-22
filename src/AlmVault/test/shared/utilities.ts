import bn from "bignumber.js";
import { keccak256, solidityPacked } from "ethers";

export const MaxUint128 = 2n ** 128n - 1n;

export const getMinTick = (tickSpacing: number) => Math.ceil(-887272 / tickSpacing) * tickSpacing;
export const getMaxTick = (tickSpacing: number) => Math.floor(887272 / tickSpacing) * tickSpacing;

bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });

export const getMaxLiquidityPerTick = (tickSpacing: number) =>
  (2n ** 128n - 1n) / BigInt((getMaxTick(tickSpacing) - getMinTick(tickSpacing)) / tickSpacing + 1);

export const MIN_SQRT_RATIO = 4295128739n;
export const MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342n;

export enum FeeAmount {
  LOW = 500,
  MEDIUM = 3000,
  HIGH = 10000,
  BAD = 444,
}

export const TICK_SPACINGS: { [amount in FeeAmount]: number } = {
  [FeeAmount.LOW]: 10,
  [FeeAmount.MEDIUM]: 60,
  [FeeAmount.HIGH]: 200,
  [FeeAmount.BAD]: 8,
};

export function encodePriceSqrt(reserve1: bigint | string | number, reserve0: bigint | string | number): bigint {
  return BigInt(
    new bn(reserve1.toString())
      .div(reserve0.toString())
      .sqrt()
      .multipliedBy(new bn(2).pow(96))
      .integerValue(3)
      .toString(),
  );
}

export function getPositionKey(address: string, lowerTick: number, upperTick: number): string {
  return keccak256(solidityPacked(["address", "int24", "int24"], [address, lowerTick, upperTick]));
}
