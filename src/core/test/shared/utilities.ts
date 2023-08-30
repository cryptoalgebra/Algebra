import bn from 'bignumber.js';
import { BigNumberish, AbiCoder, ContractTransactionResponse, keccak256, getAddress, Wallet, MaxUint256 } from 'ethers';
import { TestAlgebraCallee, TestAlgebraRouter, MockTimeAlgebraPool, TestERC20 } from '../../typechain';

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

export const TICK_SPACINGS: { [amount in FeeAmount]: number } = {
  [FeeAmount.LOW]: 10,
  [FeeAmount.MEDIUM]: 60,
  [FeeAmount.HIGH]: 100,
};

export function expandTo18Decimals(n: number): bigint {
  return BigInt(n) * (10n ** 18n);
}

export function getCreate2Address(
  factoryAddress: string,
  [tokenA, tokenB]: [string, string],
  bytecode: string
): string {
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
  if(paid0) return AbiCoder.defaultAbiCoder().encode(['address', 'uint256', 'uint256'], [address, paid0, paid1])
  return AbiCoder.defaultAbiCoder().encode(['address'], [address])
} 

bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });

// returns the sqrt price as a 64x96
export function encodePriceSqrt(reserve1: BigNumberish, reserve0: BigNumberish): bigint {
  return BigInt(
    new bn(reserve1.toString())
      .div(reserve0.toString())
      .sqrt()
      .multipliedBy(new bn(2).pow(96))
      .integerValue(3)
      .toString()
  );
}

export function getPositionKey(
  address: string,
  bottomTick: number,
  topTick: number,
  pool: MockTimeAlgebraPool
): Promise<string> {
  return pool.getKeyForPosition(address, bottomTick, topTick);
}

export function getLimitPositionKey(address: string, tick: number, pool: MockTimeAlgebraPool): Promise<string> {
  return pool.getKeyForLimitPosition(address, tick);
}

export type SwapFunction = (
  amount: BigNumberish,
  to: Wallet | string,
  limitSqrtPrice?: BigNumberish
) => Promise<ContractTransactionResponse>;
export type SwapToPriceFunction = (price: BigNumberish, to: Wallet | string) => Promise<ContractTransactionResponse>;
export type FlashFunction = (
  amount0: BigNumberish,
  amount1: BigNumberish,
  to: Wallet | string,
  pay0?: BigNumberish,
  pay1?: BigNumberish
) => Promise<ContractTransactionResponse>;
export type AddLimitFunction = (recipient: string, tick: number, amount: BigNumberish) => Promise<ContractTransactionResponse>;
export type MintFunction = (
  recipient: string,
  bottomTick: BigNumberish,
  topTick: BigNumberish,
  liquidity: BigNumberish
) => Promise<ContractTransactionResponse>;
export interface PoolFunctions {
  swapToLowerPrice: SwapToPriceFunction;
  swapToHigherPrice: SwapToPriceFunction;
  swapExact0For1: SwapFunction;
  swapExact0For1SupportingFee: SwapFunction;
  swap0ForExact1: SwapFunction;
  swapExact1For0: SwapFunction;
  swapExact1For0SupportingFee: SwapFunction;
  swap1ForExact0: SwapFunction;
  flash: FlashFunction;
  mint: MintFunction;
}
export function createPoolFunctions({
  swapTarget,
  token0,
  token1,
  pool,
}: {
  swapTarget: TestAlgebraCallee;
  token0: TestERC20;
  token1: TestERC20;
  pool: MockTimeAlgebraPool;
}): PoolFunctions {
  async function swapToSqrtPrice(
    inputToken: TestERC20,
    targetPrice: BigNumberish,
    to: Wallet | string
  ): Promise<ContractTransactionResponse> {
    const method = inputToken === token0 ? swapTarget.swapToLowerSqrtPrice : swapTarget.swapToHigherSqrtPrice;

    await inputToken.approve(swapTarget, MaxUint256);

    const toAddress = typeof to === 'string' ? to : to.address;

    return method(pool, targetPrice, toAddress);
  }

  async function swap(
    inputToken: TestERC20,
    [amountIn, amountOut]: [BigNumberish, BigNumberish],
    to: Wallet | string,
    limitSqrtPrice?: BigNumberish,
    supportingFee?: boolean
  ): Promise<ContractTransactionResponse> {
    const exactInput = amountOut === 0;

    const method =
      inputToken === token0
        ? exactInput
          ? supportingFee
            ? swapTarget.swapExact0For1SupportingFee
            : swapTarget.swapExact0For1
          : swapTarget.swap0ForExact1
        : exactInput
        ? supportingFee
          ? swapTarget.swapExact1For0SupportingFee
          : swapTarget.swapExact1For0
        : swapTarget.swap1ForExact0;

    if (typeof limitSqrtPrice === 'undefined') {
      if (inputToken === token0) {
        limitSqrtPrice = MIN_SQRT_RATIO + 1n;
      } else {
        limitSqrtPrice = MAX_SQRT_RATIO - 1n;
      }
    }
    await inputToken.approve(swapTarget, MaxUint256);

    const toAddress = typeof to === 'string' ? to : to.address;

    return method(pool, exactInput ? amountIn : amountOut, toAddress, limitSqrtPrice);
  }

  const swapToLowerPrice: SwapToPriceFunction = (price, to) => {
    return swapToSqrtPrice(token0, price, to);
  };

  const swapToHigherPrice: SwapToPriceFunction = (price, to) => {
    return swapToSqrtPrice(token1, price, to);
  };

  const swapExact0For1: SwapFunction = (amount, to, limitSqrtPrice) => {
    return swap(token0, [amount, 0], to, limitSqrtPrice);
  };

  const swapExact0For1SupportingFee: SwapFunction = (amount, to, limitSqrtPrice) => {
    return swap(token0, [amount, 0], to, limitSqrtPrice, true);
  };

  const swap0ForExact1: SwapFunction = (amount, to, limitSqrtPrice) => {
    return swap(token0, [0, amount], to, limitSqrtPrice);
  };

  const swapExact1For0: SwapFunction = (amount, to, limitSqrtPrice) => {
    return swap(token1, [amount, 0], to, limitSqrtPrice);
  };

  const swapExact1For0SupportingFee: SwapFunction = (amount, to, limitSqrtPrice) => {
    return swap(token1, [amount, 0], to, limitSqrtPrice, true);
  };

  const swap1ForExact0: SwapFunction = (amount, to, limitSqrtPrice) => {
    return swap(token1, [0, amount], to, limitSqrtPrice);
  };

  const mint: MintFunction = async (recipient, bottomTick, topTick, liquidity) => {
    await token0.approve(swapTarget, MaxUint256);
    await token1.approve(swapTarget, MaxUint256);
    return swapTarget.mint(pool, recipient, bottomTick, topTick, liquidity);
  };

  const flash: FlashFunction = async (amount0, amount1, to, pay0?: BigNumberish, pay1?: BigNumberish) => {
    const fee = 100;
    if (typeof pay0 === 'undefined') {
      pay0 = (BigInt(amount0) * BigInt(fee) + BigInt(1e6 - 1)) / BigInt(1e6) + BigInt(amount0)
    }
    if (typeof pay1 === 'undefined') {
      pay1 = (BigInt(amount1) * BigInt(fee) + BigInt(1e6 - 1)) / BigInt(1e6) + BigInt(amount1)
    }
    return swapTarget.flash(pool, typeof to === 'string' ? to : to.address, amount0, amount1, pay0, pay1);
  };

  return {
    swapToLowerPrice,
    swapToHigherPrice,
    swapExact0For1,
    swapExact0For1SupportingFee,
    swap0ForExact1,
    swapExact1For0,
    swapExact1For0SupportingFee,
    swap1ForExact0,
    mint,
    flash,
  };
}

export interface MultiPoolFunctions {
  swapForExact0Multi: SwapFunction;
  swapForExact1Multi: SwapFunction;
}

export function createMultiPoolFunctions({
  inputToken,
  swapTarget,
  poolInput,
  poolOutput,
}: {
  inputToken: TestERC20;
  swapTarget: TestAlgebraRouter;
  poolInput: MockTimeAlgebraPool;
  poolOutput: MockTimeAlgebraPool;
}): MultiPoolFunctions {
  async function swapForExact0Multi(amountOut: BigNumberish, to: Wallet | string): Promise<ContractTransactionResponse> {
    const method = swapTarget.swapForExact0Multi;
    await inputToken.approve(swapTarget, MaxUint256);
    const toAddress = typeof to === 'string' ? to : to.address;
    return method(toAddress, poolInput, poolOutput, amountOut);
  }

  async function swapForExact1Multi(amountOut: BigNumberish, to: Wallet | string): Promise<ContractTransactionResponse> {
    const method = swapTarget.swapForExact1Multi;
    await inputToken.approve(swapTarget, MaxUint256);
    const toAddress = typeof to === 'string' ? to : to.address;
    return method(toAddress, poolInput, poolOutput, amountOut);
  }

  return {
    swapForExact0Multi,
    swapForExact1Multi,
  };
}
