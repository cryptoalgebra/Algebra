import {
  abi as FACTORY_ABI,
  bytecode as FACTORY_BYTECODE,
} from '@cryptoalgebra/core/artifacts/contracts/AlgebraFactory.sol/AlgebraFactory.json'
import {
  abi as POOL_DEPLOYER_ABI,
  bytecode as POOL_DEPLOYER_BYTECODE,
} from '@cryptoalgebra/core/artifacts/contracts/AlgebraPoolDeployer.sol/AlgebraPoolDeployer.json'
import { abi as FACTORY_V2_ABI, bytecode as FACTORY_V2_BYTECODE } from '@uniswap/v2-core/build/UniswapV2Factory.json'
import { ethers } from 'hardhat'
import { IAlgebraFactory, IWNativeToken, MockTimeSwapRouter } from '../../typechain'

import WNativeToken from '../contracts/WNativeToken.json'
import { Contract } from '@ethersproject/contracts'
import { constants, Wallet } from 'ethers'

export const vaultAddress = '0x1d8b6fA722230153BE08C4Fa4Aa4B4c7cd01A95a';

const wnativeFixture: () => Promise<{ wnative: IWNativeToken }> = async () => {
  const wnativeFactory = await ethers.getContractFactory(WNativeToken.abi,  WNativeToken.bytecode);
  const wnative = (await wnativeFactory.deploy()) as IWNativeToken;

  return { wnative }
}

export const v2FactoryFixture: () => Promise<{ factory: Contract }> = async () => {
  const v2FactoryFactory = await ethers.getContractFactory(FACTORY_V2_ABI,  FACTORY_V2_BYTECODE);
  const factory = await v2FactoryFactory.deploy(constants.AddressZero);

  return { factory }
}

const v3CoreFactoryFixture: () => Promise<IAlgebraFactory> = async () => {
  const poolDeployerFactory = await ethers.getContractFactory(POOL_DEPLOYER_ABI,  POOL_DEPLOYER_BYTECODE);
  const poolDeployer = await poolDeployerFactory.deploy();
  const v3FactoryFactory = await ethers.getContractFactory(FACTORY_ABI,  FACTORY_BYTECODE);
  const _factory = (await v3FactoryFactory.deploy(poolDeployer.address, vaultAddress)) as IAlgebraFactory;

  poolDeployer.setFactory(_factory.address)
  return _factory
}

export const v3RouterFixture: () => Promise<{
  wnative: IWNativeToken
  factory: IAlgebraFactory
  router: MockTimeSwapRouter
}> = async () => {
  const { wnative } = await wnativeFixture()
  const factory = await v3CoreFactoryFixture()
  const router = (await (await ethers.getContractFactory('MockTimeSwapRouter')).deploy(
    factory.address,
    wnative.address,
      await factory.poolDeployer()
  )) as MockTimeSwapRouter

  return { factory, wnative, router }
}
