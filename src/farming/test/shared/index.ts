export * from './external/v3-periphery/constants';
export * from './external/v3-periphery/ticks';
export * from './external/v3-periphery/tokenSort';
export * from './fixtures';
export * from './actors';
export * from './ticks';

import { provider } from './provider';
import { BigNumberish, Contract, ContractTransactionResponse, ContractTransaction } from 'ethers';
import { TransactionReceipt, TransactionResponse } from '@ethersproject/abstract-provider';

import bn from 'bignumber.js';

import { expect, use } from 'chai';
import { jestSnapshotPlugin } from 'mocha-chai-jest-snapshot';

import { IAlgebraPool, TestERC20 } from '../../typechain';
import { isArray, isString } from 'lodash';
import { ethers } from 'hardhat';

export const blockTimestamp = async () => {
  const block = await provider.getBlock('latest');
  if (!block) {
    throw new Error('null block returned from provider');
  }
  return block.timestamp;
};

bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });

use(jestSnapshotPlugin());

export { expect };

// returns the sqrt price as a 64x96
export const encodePriceSqrt = (reserve1: BigNumberish, reserve0: BigNumberish): bigint => {
  return BigInt(new bn(reserve1.toString()).div(reserve0.toString()).sqrt().multipliedBy(new bn(2).pow(96)).integerValue(3).toString());
};

export const BN = BigInt;
export const BNe = (n: BigNumberish, exponent: BigNumberish) => BN(n) * 10n ** BigInt(exponent);
export const BNe18 = (n: BigNumberish) => BNe(n, 18);

export const divE18 = (n: bigint) => Number(n / BNe18('1'));
export const ratioE18 = (a: bigint, b: bigint) => (divE18(a) / divE18(b)).toFixed(2);

const bigNumberSum = (arr: Array<bigint>) => arr.reduce((acc, item) => acc + item, BN('0'));

export const bnSum = bigNumberSum;

export { BigNumberish } from 'ethers';

export async function snapshotGasCost(
  x:
    | TransactionResponse
    | Promise<TransactionResponse>
    | ContractTransactionResponse
    | ContractTransaction
    | Promise<ContractTransaction>
    | Promise<ContractTransactionResponse>
    | TransactionReceipt
    | Promise<BigInt>
    | BigInt
    | Contract
    | Promise<Contract>
): Promise<void> {
  const resolved = await x;
  if (typeof resolved == 'bigint' || resolved instanceof Number || typeof resolved == 'number') {
    expect(Number(resolved)).toMatchSnapshot();
  } else if ('deployTransaction' in resolved) {
    const receipt = await resolved.deployTransaction.wait();
    expect(receipt.gasUsed.toNumber()).toMatchSnapshot();
  } else if ('wait' in resolved) {
    const waited = await resolved.wait();
    expect(Number(waited.gasUsed)).toMatchSnapshot();
  }
}

export function encodePath(path: string[]): string {
  let encoded = '0x';
  for (let i = 0; i < path.length; i++) {
    // 20 byte encoding of the address
    encoded += path[i].slice(2);
  }

  return encoded.toLowerCase();
}

export const MIN_SQRT_RATIO = BigInt('4295128739');
export const MAX_SQRT_RATIO = BigInt('1461446703485210103287273052203988822378723970342');

export const MAX_GAS_LIMIT = 12_450_000;
export const maxGas = {
  gasLimit: MAX_GAS_LIMIT,
};

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const days = (n: number) => 86_400 * n;

export const getSlot0 = async (pool: IAlgebraPool) => {
  return await pool.globalState();
};

// This is currently lpUser0 but can be called from anybody.
export const getCurrentTick = async (pool: IAlgebraPool): Promise<number> => Number((await getSlot0(pool)).tick);

export const arrayWrap = (x: any) => {
  if (!isArray(x)) {
    return [x];
  }
  return x;
};

export const erc20Wrap = async (x: string | TestERC20): Promise<TestERC20> => {
  if (isString(x)) {
    const factory = await ethers.getContractFactory('TestERC20');
    return factory.attach(x) as any as TestERC20;
  }
  return x;
};

export const makeTimestamps = (n: number, duration: number = 1_000) => ({
  startTime: n + 100,
  endTime: n + 100 + duration,
});
