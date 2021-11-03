import {
  abi as FACTORY_ABI,
  bytecode as FACTORY_BYTECODE,
} from 'algebra/artifacts/contracts/AlgebraFactory.sol/AlgebraFactory.json'
import {
  abi as POOL_DEPLOYER_ABI,
  bytecode as POOL_DEPLOYER_BYTECODE,
} from 'algebra/artifacts/contracts/AlgebraPoolDeployer.sol/AlgebraPoolDeployer.json'
import { abi as FACTORY_V2_ABI, bytecode as FACTORY_V2_BYTECODE } from '@uniswap/v2-core/build/UniswapV2Factory.json'
import { Fixture } from 'ethereum-waffle'
import { ethers, waffle } from 'hardhat'
import { IAlgebraFactory, IWNativeToken, MockTimeSwapRouter } from '../../typechain'

import WNativeToken from '../contracts/WNativeToken.json'
import { Contract } from '@ethersproject/contracts'
import { constants } from 'ethers'

export const vaultAddress = '0x1d8b6fA722230153BE08C4Fa4Aa4B4c7cd01A95a';

const wnativeFixture: Fixture<{ wnative: IWNativeToken }> = async ([wallet]) => {
  const wnative = (await waffle.deployContract(wallet, {
    bytecode: WNativeToken.bytecode,
    abi: WNativeToken.abi,
  })) as IWNativeToken

  return { wnative }
}

export const v2FactoryFixture: Fixture<{ factory: Contract }> = async ([wallet]) => {
  const factory = await waffle.deployContract(
    wallet,
    {
      bytecode: FACTORY_V2_BYTECODE,
      abi: FACTORY_V2_ABI,
    },
    [constants.AddressZero]
  )

  return { factory }
}

const v3CoreFactoryFixture: Fixture<IAlgebraFactory> = async ([wallet]) => {
  const poolDeployer = await waffle.deployContract(wallet, {
    bytecode: POOL_DEPLOYER_BYTECODE,
    abi: POOL_DEPLOYER_ABI
  })
  const _factory = (await waffle.deployContract(wallet, {
    bytecode: FACTORY_BYTECODE,
    abi: FACTORY_ABI,
  },
      [poolDeployer.address, vaultAddress])) as IAlgebraFactory

  poolDeployer.setFactory(_factory.address)
  return _factory
}

export const v3RouterFixture: Fixture<{
  wnative: IWNativeToken
  factory: IAlgebraFactory
  router: MockTimeSwapRouter
}> = async ([wallet], provider) => {
  const { wnative } = await wnativeFixture([wallet], provider)
  const factory = await v3CoreFactoryFixture([wallet], provider)
  const router = (await (await ethers.getContractFactory('MockTimeSwapRouter')).deploy(
    factory.address,
    wnative.address,
      await factory.poolDeployer()
  )) as MockTimeSwapRouter

  return { factory, wnative, router }
}
