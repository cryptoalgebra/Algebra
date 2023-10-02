import { ethers } from 'hardhat';
import { abi as FACTORY_ABI, bytecode as FACTORY_BYTECODE } from '@cryptoalgebra/integral-core/artifacts/contracts/AlgebraFactory.sol/AlgebraFactory.json';
import {
  abi as TEST_CALLEE_ABI,
  bytecode as TEST_CALLEE_BYTECODE,
} from '@cryptoalgebra/integral-core/artifacts/contracts/test/TestAlgebraCallee.sol/TestAlgebraCallee.json';
import {
  abi as POOL_DEPLOYER_ABI,
  bytecode as POOL_DEPLOYER_BYTECODE,
} from '@cryptoalgebra/integral-core/artifacts/contracts/AlgebraPoolDeployer.sol/AlgebraPoolDeployer.json';
import {
  abi as POOL_ABI,
  bytecode as POOL_BYTECODE,
} from '@cryptoalgebra/integral-core/artifacts/contracts/AlgebraPool.sol/AlgebraPool.json';
import { MockFactory, MockPool, MockTimeAlgebraBasePluginV1, MockTimeDSFactory, BasePluginV1Factory, LimitOrderPlugin } from '../../typechain';
import {tokensFixture} from './externalFixtures';
import { getCreateAddress } from 'ethers';
import {AlgebraPool, AlgebraFactory, TestAlgebraCallee, AlgebraPoolDeployer, TestERC20 } from '@cryptoalgebra/integral-core/typechain';

type Fixture<T> = () => Promise<T>;
interface MockFactoryFixture {
  mockFactory: MockFactory;
}
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

async function mockFactoryFixture(): Promise<MockFactoryFixture> {
  const mockFactoryFactory = await ethers.getContractFactory('MockFactory');
  const mockFactory = (await mockFactoryFactory.deploy()) as any as MockFactory;

  return { mockFactory };
}

interface PluginFixture extends MockFactoryFixture {
  plugin: MockTimeAlgebraBasePluginV1;
  mockPluginFactory: MockTimeDSFactory;
  mockPool: MockPool;
}

// Monday, October 5, 2020 9:00:00 AM GMT-05:00
export const TEST_POOL_START_TIME = 1601906400;
export const TEST_POOL_DAY_BEFORE_START = 1601906400 - 24 * 60 * 60;

export const pluginFixture: Fixture<PluginFixture> = async function (): Promise<PluginFixture> {
  const { mockFactory } = await mockFactoryFixture();
  //const { token0, token1, token2 } = await tokensFixture()

  const mockPluginFactoryFactory = await ethers.getContractFactory('MockTimeDSFactory');
  const mockPluginFactory = (await mockPluginFactoryFactory.deploy(mockFactory)) as any as MockTimeDSFactory;

  const mockPoolFactory = await ethers.getContractFactory('MockPool');
  const mockPool = (await mockPoolFactory.deploy()) as any as MockPool;

  await mockPluginFactory.createPlugin(mockPool);
  const pluginAddress = await mockPluginFactory.pluginByPool(mockPool);

  const mockDSOperatorFactory = await ethers.getContractFactory('MockTimeAlgebraBasePluginV1');
  const plugin = mockDSOperatorFactory.attach(pluginAddress) as any as MockTimeAlgebraBasePluginV1;

  return {
    plugin,
    mockPluginFactory,
    mockPool,
    mockFactory,
  };
};

interface PluginFactoryFixture extends MockFactoryFixture {
  pluginFactory: BasePluginV1Factory;
}

export const pluginFactoryFixture: Fixture<PluginFactoryFixture> = async function (): Promise<PluginFactoryFixture> {
  const { mockFactory } = await mockFactoryFixture();

  const pluginFactoryFactory = await ethers.getContractFactory('BasePluginV1Factory');
  const pluginFactory = (await pluginFactoryFactory.deploy(mockFactory)) as any as BasePluginV1Factory;

  return {
    pluginFactory,
    mockFactory,
  };
};

interface LimitOrderPluginFixture{
  pluginFactory: BasePluginV1Factory;
  loPlugin: LimitOrderPlugin;
  token0: TestERC20;
  token1: TestERC20;
  pool: AlgebraPool;
  swapTarget: TestAlgebraCallee;
 }


export const limitOrderPluginFixture: Fixture<LimitOrderPluginFixture> = async function (): Promise<LimitOrderPluginFixture> {

  const { token0, token1 } = await tokensFixture();

  const [deployer] = await ethers.getSigners();
  // precompute
  const poolDeployerAddress = getCreateAddress({
    from: deployer.address,
    nonce: (await ethers.provider.getTransactionCount(deployer.address)) + 1,
  });

  const factoryFactory = await ethers.getContractFactory(FACTORY_ABI, FACTORY_BYTECODE);
  const factory = (await factoryFactory.deploy(poolDeployerAddress)) as any as AlgebraFactory;

  const poolDeployerFactory = await ethers.getContractFactory(POOL_DEPLOYER_ABI, POOL_DEPLOYER_BYTECODE);
  const poolDeployer = (await poolDeployerFactory.deploy(factory, factory)) as any as AlgebraPoolDeployer;

  const calleeContractFactory = await ethers.getContractFactory(TEST_CALLEE_ABI, TEST_CALLEE_BYTECODE);
  const swapTarget = (await calleeContractFactory.deploy()) as any as TestAlgebraCallee;

  const poolFactory = await ethers.getContractFactory(POOL_ABI, POOL_BYTECODE);

  const BasePluginV1FactoryFactory = await ethers.getContractFactory('BasePluginV1Factory');
  const pluginFactory = (await BasePluginV1FactoryFactory.deploy(factory)) as any as BasePluginV1Factory;

  const loPluginFactory = await ethers.getContractFactory('LimitOrderPlugin');
  const loPlugin = (await loPluginFactory.deploy(ZERO_ADDRESS, poolDeployer, pluginFactory, factory)) as any as LimitOrderPlugin

  await pluginFactory.setLimitOrderPlugin(loPlugin);
  await factory.setDefaultPluginFactory(pluginFactory)

  await factory.createPool(token0, token1);
  const poolAddress = await factory.poolByPair(token0, token1);
  const pool = (poolFactory.attach(poolAddress)) as any as AlgebraPool;

  return {
    pluginFactory,
    loPlugin,
    token0,
    token1,
    pool,
    swapTarget
  };
};