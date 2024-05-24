import { ethers } from 'hardhat';
import { AlgebraModularHub, FarmingModule, MockPool, MockTimeOracleModule, MockTimeDynamicFeeModule, MockTimeDSFactory, BasePluginV1Factory, MockFactory, FarmingModuleFactory, MockTimeOracleModuleFactory, MockTimeDynamicFeeModuleFactory } from '../../typechain';

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
  plugin: AlgebraModularHub;
  mockPool: MockPool;
  mockPluginFactory: MockTimeDSFactory;
  mockOracleModule: MockTimeOracleModule;
  mockDynamicFeeModule: MockTimeDynamicFeeModule;
  mockFarmingModule: FarmingModule;
  farmingModuleFactory: FarmingModuleFactory;
}

// Monday, October 5, 2020 9:00:00 AM GMT-05:00
export const TEST_POOL_START_TIME = 1601906400;
export const TEST_POOL_DAY_BEFORE_START = 1601906400 - 24 * 60 * 60;

export const pluginFixture: Fixture<PluginFixture> = async function (): Promise<PluginFixture> {
  const { mockFactory } = await mockFactoryFixture();
  //const { token0, token1, token2 } = await tokensFixture()

  const dynamicFeeModuleFactoryFactory = await ethers.getContractFactory('MockTimeDynamicFeeModuleFactory');
  const dynamicFeeModuleFactory = await dynamicFeeModuleFactoryFactory.deploy(mockFactory);

  const farmingModuleFactoryFactory = await ethers.getContractFactory('FarmingModuleFactory');
  const farmingModuleFactory = await farmingModuleFactoryFactory.deploy(mockFactory) as any as FarmingModuleFactory;

  const mockTimeOracleModuleFactoryFactory = await ethers.getContractFactory('MockTimeOracleModuleFactory');
  const mockTimeOracleModuleFactory = await mockTimeOracleModuleFactoryFactory.deploy(mockFactory);

  const mockPluginFactoryFactory = await ethers.getContractFactory('MockTimeDSFactory');
  const mockPluginFactory = (await mockPluginFactoryFactory.deploy(mockFactory, [mockTimeOracleModuleFactory, dynamicFeeModuleFactory, farmingModuleFactory])) as any as MockTimeDSFactory;

  await mockFactory.grantRole(ethers.keccak256(ethers.toUtf8Bytes("POOLS_ADMINISTRATOR")), mockPluginFactory);

  const mockPoolFactory = await ethers.getContractFactory('MockPool');
  const mockPool = (await mockPoolFactory.deploy()) as any as MockPool;

  await mockPool.setPluginFactory(mockPluginFactory);

  await mockFactory.grantRole(ethers.keccak256(ethers.toUtf8Bytes("ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR")), mockPluginFactory);

  await mockPluginFactory.beforeCreatePoolHook(mockPool, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, '0x');
  const pluginAddress = await mockPluginFactory.pluginByPool(mockPool);


  const algebraModularHubFactory = await ethers.getContractFactory('AlgebraModularHub');
  const plugin = algebraModularHubFactory.attach(pluginAddress) as any as AlgebraModularHub;

  // plugin indexing inside modular hub starts from 1
  const mockTimeOracleModuleAddress = await plugin.modules(1);
  const dynamicFeeModuleAddress = await plugin.modules(2);
  const farmingModuleAddress = await plugin.modules(3);

  console.log("oracle module: ", mockTimeOracleModuleAddress);
  console.log("dynamic fee module: ", dynamicFeeModuleAddress);
  console.log("farming module: ", farmingModuleAddress);

  const mockTimeOracleModuleFactory_ethers = await ethers.getContractFactory('MockTimeOracleModule');
  const mockOracleModule = mockTimeOracleModuleFactory_ethers.attach(mockTimeOracleModuleAddress) as any as MockTimeOracleModule;

  const mockTimeDynamicFeeModule_ethers = await ethers.getContractFactory('MockTimeDynamicFeeModule');
  const mockDynamicFeeModule = mockTimeDynamicFeeModule_ethers.attach(dynamicFeeModuleAddress) as any as MockTimeDynamicFeeModule;

  const farmingModuleFactory_ethers = await ethers.getContractFactory('FarmingModule');
  const mockFarmingModule = farmingModuleFactory_ethers.attach(farmingModuleAddress) as any as FarmingModule;


  return {
    plugin,
    mockPluginFactory,
    mockPool,
    mockOracleModule,
    mockFarmingModule,
    mockDynamicFeeModule,
    farmingModuleFactory,
    mockFactory,
  };
};

interface PluginFactoryFixture extends MockFactoryFixture {
  pluginFactory: BasePluginV1Factory;
  mockPool: MockPool;
  mockOracleModuleFactory: MockTimeOracleModuleFactory;
  mockDynamicFeeModuleFactory: MockTimeDynamicFeeModuleFactory;
  farmingModuleFactory: FarmingModuleFactory;
}

export const pluginFactoryFixture: Fixture<PluginFactoryFixture> = async function (): Promise<PluginFactoryFixture> {
  const { mockFactory } = await mockFactoryFixture();

  const mockDynamicFeeModuleFactoryFactory = await ethers.getContractFactory('MockTimeDynamicFeeModuleFactory');
  const mockDynamicFeeModuleFactory = await mockDynamicFeeModuleFactoryFactory.deploy(mockFactory) as any as MockTimeDynamicFeeModuleFactory;

  const farmingModuleFactoryFactory = await ethers.getContractFactory('FarmingModuleFactory');
  const farmingModuleFactory = await farmingModuleFactoryFactory.deploy(mockFactory) as any as FarmingModuleFactory;

  const mockOracleModuleFactoryFactory = await ethers.getContractFactory('MockTimeOracleModuleFactory');
  const mockOracleModuleFactory = await mockOracleModuleFactoryFactory.deploy(mockFactory) as any as MockTimeOracleModuleFactory;

  const pluginFactoryFactory = await ethers.getContractFactory('BasePluginV1Factory');
  const pluginFactory = (await pluginFactoryFactory.deploy(mockFactory, [mockOracleModuleFactory, mockDynamicFeeModuleFactory, farmingModuleFactory])) as any as BasePluginV1Factory;

  const mockPoolFactory = await ethers.getContractFactory('MockPool');
  const mockPool = (await mockPoolFactory.deploy()) as any as MockPool;

  await mockPool.setPluginFactory(pluginFactory);

  return {
    pluginFactory,
    mockPool,
    mockOracleModuleFactory,
    mockDynamicFeeModuleFactory,
    farmingModuleFactory,
    mockFactory,
  };
};
