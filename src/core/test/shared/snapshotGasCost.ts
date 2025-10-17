import { TransactionReceipt, TransactionResponse } from '@ethersproject/abstract-provider';
import { expect } from './expect';
import { Contract, ContractTransactionResponse } from 'ethers';

export default async function snapshotGasCost(
  x:
    | TransactionResponse
    | Promise<TransactionResponse>
    | ContractTransactionResponse
    | Promise<ContractTransactionResponse>
    | TransactionReceipt
    | Promise<bigint>
    | bigint
    | Contract
    | Promise<Contract>
): Promise<void> {
  const resolved = await x;
  if (typeof resolved === 'bigint') {
    expect(Number(resolved)).toMatchSnapshot();
  } else if ('deploymentTransaction' in resolved) {
    const receipt = await resolved.deploymentTransaction()?.wait();
    if (receipt) {
      expect(Number(receipt.gasUsed)).toMatchSnapshot();
    } else {
        console.warn('⚠️Deployment transaction returned null. Skipping gas usage snapshot.\n', new Error().stack);
    }
  } else if ('wait' in resolved) {
    const waited = await resolved.wait();
    if (waited) {
        expect(Number(waited.gasUsed)).toMatchSnapshot();
    } else {
        console.warn('⚠️Transaction returned null. Skipping gas usage snapshot.\n', new Error().stack);
    }
  }
}
