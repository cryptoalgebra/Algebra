import { bytecode } from '@cryptoalgebra/integral-core/artifacts/contracts/AlgebraPool.sol/AlgebraPool.json';
import { keccak256, getAddress, AbiCoder } from 'ethers';

export const POOL_BYTECODE_HASH = keccak256(bytecode);

export function computePoolAddress(factoryAddress: string, [tokenA, tokenB]: [string, string]): string {
  const [token0, token1] = tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];
  const constructorArgumentsEncoded = AbiCoder.defaultAbiCoder().encode(['address', 'address'], [token0, token1]);
  const create2Inputs = [
    '0xff',
    factoryAddress,
    // salt
    keccak256(constructorArgumentsEncoded),
    // init code hash
    POOL_BYTECODE_HASH,
  ];
  const sanitizedInputs = `0x${create2Inputs.map((i) => i.slice(2)).join('')}`;
  return getAddress(`0x${keccak256(sanitizedInputs).slice(-40)}`);
}
