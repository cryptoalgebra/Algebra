import { TransactionReceipt, TransactionResponse } from '@ethersproject/abstract-provider';
import { expect } from './expect';
import { ContractTransactionResponse } from 'ethers';

export default async function snapshotGasCost(
  x:
    | TransactionResponse
    | Promise<TransactionResponse>
    | ContractTransactionResponse
    | Promise<ContractTransactionResponse>
    | TransactionReceipt
    | Promise<BigInt>
    | BigInt
): Promise<void> {
  const resolved = await x;
  if (typeof resolved == 'bigint' || resolved instanceof Number || typeof resolved == 'number') {
    expect(Number(resolved)).toMatchSnapshot();
  } else if ('wait' in resolved) {
    const waited = await resolved.wait();
    expect(Number(waited!.gasUsed)).toMatchSnapshot();
  }
}
