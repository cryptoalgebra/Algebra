import { ethers } from 'hardhat'
import { MockFactory, MockPool, MockTimeDataStorageOperator, TestERC20, MockTimeDSFactory, DataStorageFactory } from "../../typechain";

type Fixture<T> = () => Promise<T>;
interface MockFactoryFixture {
  mockFactory: MockFactory;
}
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

async function mockFactoryFixture(): Promise<MockFactoryFixture> {
  const [deployer] = await ethers.getSigners();

  const mockFactoryFactory = await ethers.getContractFactory('MockFactory')
  const mockFactory = (await mockFactoryFactory.deploy()) as any as MockFactory

  return { mockFactory }
}
interface TokensFixture {
  token0: TestERC20;
  token1: TestERC20;
  token2: TestERC20;
}

async function tokensFixture(): Promise<TokensFixture> {
  const tokenFactory = await ethers.getContractFactory('TestERC20');
  const tokenA = (await tokenFactory.deploy(2n ** 255n)) as any as TestERC20 & {address_: string};
  const tokenB = (await tokenFactory.deploy(2n ** 255n)) as any as TestERC20 & {address_: string};
  const tokenC = (await tokenFactory.deploy(2n ** 255n)) as any as TestERC20 & {address_: string};

  tokenA.address_ = await tokenA.getAddress();
  tokenB.address_ = await tokenB.getAddress();
  tokenC.address_ = await tokenC.getAddress();

  const [token0, token1, token2] = [tokenA, tokenB, tokenC].sort((tokenA, tokenB) =>
    tokenA.address_.toLowerCase() < tokenB.address_.toLowerCase() ? -1 : 1
  );

  return { token0, token1, token2 };
}

type TokensAndMockFactoryFixture = MockFactoryFixture & TokensFixture

interface PluginFixture extends MockFactoryFixture {
  plugin: MockTimeDataStorageOperator;
  mockPluginFactory: MockTimeDSFactory;
  mockPool: MockPool;
}

// Monday, October 5, 2020 9:00:00 AM GMT-05:00
export const TEST_POOL_START_TIME = 1601906400
export const TEST_POOL_DAY_BEFORE_START = 1601906400 - 24*60*60

export const pluginFixture: Fixture<PluginFixture> = async function (): Promise<PluginFixture> {
  const { mockFactory } = await mockFactoryFixture()
  //const { token0, token1, token2 } = await tokensFixture()

  const mockPluginFactoryFactory = await ethers.getContractFactory('MockTimeDSFactory')
  const mockPluginFactory = (await mockPluginFactoryFactory.deploy(mockFactory)) as any as MockTimeDSFactory

  const mockPoolFactory = await ethers.getContractFactory('MockPool')
  const mockPool = (await mockPoolFactory.deploy()) as any as MockPool

  await mockPluginFactory.createPlugin(mockPool);
  const pluginAddress = await mockPluginFactory.pluginsForPools(mockPool);

  const mockDSOperatorFactory = await ethers.getContractFactory('MockTimeDataStorageOperator')
  const plugin = mockDSOperatorFactory.attach(pluginAddress) as any as MockTimeDataStorageOperator;

  return {
    plugin,
    mockPluginFactory,
    mockPool,
    mockFactory
  }
}

interface PluginFactoryFixture extends MockFactoryFixture {
  pluginFactory: DataStorageFactory;
}

export const pluginFactoryFixture: Fixture<PluginFactoryFixture> = async function (): Promise<PluginFactoryFixture> {
  const { mockFactory } = await mockFactoryFixture()

  const pluginFactoryFactory = await ethers.getContractFactory('DataStorageFactory')
  const pluginFactory = (await pluginFactoryFactory.deploy(mockFactory)) as any as DataStorageFactory

  return {
    pluginFactory,
    mockFactory
  }
}

