import { abi as POOL_ABI } from '@cryptoalgebra/core/artifacts/contracts/AlgebraPool.sol/AlgebraPool.json'
import { Contract, Wallet } from 'ethers'
import { IAlgebraPool } from '../../typechain'

export default function poolAtAddress(address: string, wallet: Wallet): IAlgebraPool {
  return new Contract(address, POOL_ABI, wallet) as IAlgebraPool
}
