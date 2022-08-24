import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'
import { MockTimeAlgebraPool } from '../../typechain/test/MockTimeAlgebraPool'
import { TestERC20 } from '../../typechain/test/TestERC20'
import { AlgebraFactory } from '../../typechain/AlgebraFactory'
import { DataStorageOperator } from "../../typechain/DataStorageOperator";
import { TestAlgebraCallee } from '../../typechain/test/TestAlgebraCallee'
import { TestAlgebraRouter } from '../../typechain/test/TestAlgebraRouter'
import { MockTimeAlgebraPoolDeployer } from '../../typechain/test/MockTimeAlgebraPoolDeployer'

import { AlgebraPoolDeployer } from "../../typechain/AlgebraPoolDeployer";

type Fixture<T> = () => Promise<T>;
interface FactoryFixture {
  factory: AlgebraFactory
}

export const vaultAddress = '0x1d8b6fA722230153BE08C4Fa4Aa4B4c7cd01A95a'

async function factoryFixture(): Promise<FactoryFixture> {
  const poolDeployerFactory = await ethers.getContractFactory('AlgebraPoolDeployer')
  const poolDeployer = (await poolDeployerFactory.deploy()) as AlgebraPoolDeployer
  const factoryFactory = await ethers.getContractFactory('AlgebraFactory')
  const factory = (await factoryFactory.deploy(poolDeployer.address, vaultAddress)) as AlgebraFactory
  return { factory }
}

interface DataStorageFixture {
  dataStorage: DataStorageOperator
}

async function dataStorageFixture(): Promise<DataStorageFixture> {
  const dataStorageFactory = await ethers.getContractFactory('DataStorageOperator')
  const dataStorage = (await dataStorageFactory.deploy()) as DataStorageOperator
  return { dataStorage }
}

interface TokensFixture {
  token0: TestERC20
  token1: TestERC20
  token2: TestERC20
}

async function tokensFixture(): Promise<TokensFixture> {
  const tokenFactory = await ethers.getContractFactory('TestERC20')
  const tokenA = (await tokenFactory.deploy(BigNumber.from(2).pow(255))) as TestERC20
  const tokenB = (await tokenFactory.deploy(BigNumber.from(2).pow(255))) as TestERC20
  const tokenC = (await tokenFactory.deploy(BigNumber.from(2).pow(255))) as TestERC20

  const [token0, token1, token2] = [tokenA, tokenB, tokenC].sort((tokenA, tokenB) =>
    tokenA.address.toLowerCase() < tokenB.address.toLowerCase() ? -1 : 1
  )

  return { token0, token1, token2 }
}

type TokensAndFactoryFixture = FactoryFixture & TokensFixture

interface PoolFixture extends TokensAndFactoryFixture {
  swapTargetCallee: TestAlgebraCallee
  swapTargetRouter: TestAlgebraRouter
  createPool(
    fee: number,
    firstToken?: TestERC20,
    secondToken?: TestERC20
  ): Promise<MockTimeAlgebraPool>
}

// Monday, October 5, 2020 9:00:00 AM GMT-05:00
export const TEST_POOL_START_TIME = 1601906400
export const TEST_POOL_DAY_BEFORE_START = 1601906400 - 24*60*60

export const poolFixture: Fixture<PoolFixture> = async function (): Promise<PoolFixture> {
  const { factory } = await factoryFixture()
  const { token0, token1, token2 } = await tokensFixture()
  //const { dataStorage } = await dataStorageFixture();

  const MockTimeAlgebraPoolDeployerFactory = await ethers.getContractFactory('MockTimeAlgebraPoolDeployer')
  const MockTimeAlgebraPoolFactory = await ethers.getContractFactory('MockTimeAlgebraPool')

  const calleeContractFactory = await ethers.getContractFactory('TestAlgebraCallee')
  const routerContractFactory = await ethers.getContractFactory('TestAlgebraRouter')

  const swapTargetCallee = (await calleeContractFactory.deploy()) as TestAlgebraCallee
  const swapTargetRouter = (await routerContractFactory.deploy()) as TestAlgebraRouter

  return {
    token0,
    token1,
    token2,
    factory,
    swapTargetCallee,
    swapTargetRouter,
    createPool: async (fee, firstToken = token0, secondToken = token1) => {
      const mockTimePoolDeployer = (await MockTimeAlgebraPoolDeployerFactory.deploy()) as MockTimeAlgebraPoolDeployer
      const tx = await mockTimePoolDeployer.deployMock(
        factory.address,
        firstToken.address,
        secondToken.address
      )

      const receipt = await tx.wait()
      const poolAddress = receipt.events?.[1].args?.pool as string
      return MockTimeAlgebraPoolFactory.attach(poolAddress) as MockTimeAlgebraPool
    },
  }
}
