import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'
import { MockTimeAlgebraPool } from '../../typechain/test/MockTimeAlgebraPool'
import { TestERC20 } from '../../typechain/test/TestERC20'
import { AlgebraFactory } from '../../typechain/AlgebraFactory'
import { AlgebraCommunityVault } from '../../typechain/AlgebraCommunityVault'
import { DataStorageOperator } from "../../typechain/DataStorageOperator";
import { TestAlgebraCallee } from '../../typechain/test/TestAlgebraCallee'
import { TestAlgebraRouter } from '../../typechain/test/TestAlgebraRouter'
import { MockTimeAlgebraPoolDeployer } from '../../typechain/test/MockTimeAlgebraPoolDeployer'

import { AlgebraPoolDeployer } from "../../typechain/AlgebraPoolDeployer";

type Fixture<T> = () => Promise<T>;
interface FactoryFixture {
  factory: AlgebraFactory
  vault: AlgebraCommunityVault;
}
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

async function factoryFixture(): Promise<FactoryFixture> {
  const [deployer] = await ethers.getSigners();
  // precompute
  const poolDeployerAddress = ethers.utils.getContractAddress({
    from: deployer.address, 
    nonce: (await deployer.getTransactionCount()) + 1
  })

  const factoryFactory = await ethers.getContractFactory('AlgebraFactory')
  const factory = (await factoryFactory.deploy(poolDeployerAddress)) as AlgebraFactory
  await factory.deployed();
  
  const vaultAddress = await factory.communityVault();

  const poolDeployerFactory = await ethers.getContractFactory('AlgebraPoolDeployer')
  const poolDeployer = (await poolDeployerFactory.deploy(factory.address, vaultAddress)) as AlgebraPoolDeployer

  const vaultFactory = await ethers.getContractFactory('AlgebraCommunityVault')
  const vault = (vaultFactory.attach(vaultAddress)) as AlgebraCommunityVault;
  return { factory, vault }
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
    firstToken?: TestERC20,
    secondToken?: TestERC20
  ): Promise<MockTimeAlgebraPool>
}

// Monday, October 5, 2020 9:00:00 AM GMT-05:00
export const TEST_POOL_START_TIME = 1601906400
export const TEST_POOL_DAY_BEFORE_START = 1601906400 - 24*60*60

export const poolFixture: Fixture<PoolFixture> = async function (): Promise<PoolFixture> {
  const { factory, vault } = await factoryFixture()
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
    vault,
    swapTargetCallee,
    swapTargetRouter,
    createPool: async (firstToken = token0, secondToken = token1) => {
      const mockTimePoolDeployer = (await MockTimeAlgebraPoolDeployerFactory.deploy()) as MockTimeAlgebraPoolDeployer
      const tx = await mockTimePoolDeployer.deployMock(
        factory.address,
        vault.address,
        firstToken.address,
        secondToken.address
      )

      const receipt = await tx.wait()
      const poolAddress = receipt.events?.[1].args?.pool as string
      return MockTimeAlgebraPoolFactory.attach(poolAddress) as MockTimeAlgebraPool;
    },
  }
}
