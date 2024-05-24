import { Wallet } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from './shared/expect';
import { ZERO_ADDRESS, pluginFactoryFixture } from './shared/fixtures';

import { BasePluginV1Factory, MockFactory, FarmingModuleFactory, MockTimeDynamicFeeModuleFactory, MockTimeOracleModuleFactory, MockPool, AlgebraModularHub, DynamicFeeModule } from '../typechain';

describe('BasePluginV1Factory', () => {
  let wallet: Wallet, other: Wallet;

  let pluginFactory: BasePluginV1Factory;
  // let mockPool: MockPool;
  let mockOracleModuleFactory: MockTimeOracleModuleFactory;
  let mockDynamicFeeModuleFactory: MockTimeDynamicFeeModuleFactory;
  let farmingModuleFactory: FarmingModuleFactory;
  let mockAlgebraFactory: MockFactory;


  before('prepare signers', async () => {
    [wallet, other] = await (ethers as any).getSigners();
  });

  beforeEach('deploy test volatilityOracle', async () => {
    ({ pluginFactory, mockOracleModuleFactory, mockDynamicFeeModuleFactory, farmingModuleFactory, mockFactory: mockAlgebraFactory } = await loadFixture(pluginFactoryFixture));
  });

  describe('#Create plugin', () => {
    it('only factory', async () => {
      expect(pluginFactory.beforeCreatePoolHook(wallet.address, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, '0x')).to.be
        .revertedWithoutReason;
    });

    it('factory can create plugin', async () => {
      const pluginFactoryFactory = await ethers.getContractFactory('BasePluginV1Factory');
      const pluginFactoryMock = (await pluginFactoryFactory.deploy(mockAlgebraFactory, [mockOracleModuleFactory, mockDynamicFeeModuleFactory, farmingModuleFactory])) as any as BasePluginV1Factory;

      const mockPoolFactory = await ethers.getContractFactory('MockPool');
      const mockPool = (await mockPoolFactory.deploy()) as any as MockPool;
    
      await mockPool.setPluginFactory(pluginFactoryMock);

      await mockAlgebraFactory.grantRole(ethers.keccak256(ethers.toUtf8Bytes("POOLS_ADMINISTRATOR")), pluginFactoryMock);
      await mockAlgebraFactory.grantRole(ethers.keccak256(ethers.toUtf8Bytes("ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR")), pluginFactoryMock);

      const pluginAddress = await mockAlgebraFactory.createPlugin.staticCall(pluginFactoryMock, mockPool);

      await mockAlgebraFactory.createPlugin(pluginFactoryMock, mockPool);

      const pluginMock = (await ethers.getContractFactory('AlgebraModularHub')).attach(pluginAddress) as any as AlgebraModularHub;

      // plugin indexing inside modular hub starts from 1
      const dynamicFeeModuleAddress = await pluginMock.modules(2);
  
      const DynamicFeeModule_ethers = await ethers.getContractFactory('DynamicFeeModule');
      const dynamicFeeModule = DynamicFeeModule_ethers.attach(dynamicFeeModuleAddress) as any as DynamicFeeModule;

      const feeConfig = await dynamicFeeModule.feeConfig();
      expect(feeConfig.baseFee).to.be.not.eq(0);
    });
  });

  describe('#CreatePluginForExistingPool', () => {
    it('only if has role', async () => {
      expect(pluginFactory.connect(other).createPluginForExistingPool(wallet.address, other.address)).to.be.revertedWithoutReason;
    });

    it('cannot create for nonexistent pool', async () => {
      await expect(pluginFactory.createPluginForExistingPool(wallet.address, other.address)).to.be.revertedWith('Pool not exist');
    });

    it('can create for existing pool', async () => {
      const tokenFactory = await ethers.getContractFactory('TestERC20');
      const token0 = await tokenFactory.deploy(1337);
      const token1 = await tokenFactory.deploy(1337);

      const poolAddress = await mockAlgebraFactory.createPool.staticCall(token0, token1);
      await mockAlgebraFactory.createPool(token0, token1)

      const mockPoolFactory = await ethers.getContractFactory('MockPool');
      const mockPool = (await mockPoolFactory.attach(poolAddress)) as any as MockPool;
    
      await mockPool.setPluginFactory(pluginFactory);

      await mockAlgebraFactory.stubPool(token0, token1, mockPool);

      await mockAlgebraFactory.grantRole(ethers.keccak256(ethers.toUtf8Bytes("POOLS_ADMINISTRATOR")), pluginFactory);
      await mockAlgebraFactory.grantRole(ethers.keccak256(ethers.toUtf8Bytes("ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR")), pluginFactory);

      await pluginFactory.createPluginForExistingPool(token0, token1);
      const pluginAddress = await pluginFactory.pluginByPool(mockPool);
      expect(pluginAddress).to.not.be.eq(ZERO_ADDRESS);
      const pluginMock = (await ethers.getContractFactory('AlgebraModularHub')).attach(pluginAddress) as any as AlgebraModularHub;

      // plugin indexing inside modular hub starts from 1
      const dynamicFeeModuleAddress = await pluginMock.modules(2);

      const DynamicFeeModule_ethers = await ethers.getContractFactory('DynamicFeeModule');
      const dynamicFeeModule = DynamicFeeModule_ethers.attach(dynamicFeeModuleAddress) as any as DynamicFeeModule;
      
      const feeConfig = await dynamicFeeModule.feeConfig();
      expect(feeConfig.baseFee).to.be.not.eq(0);
    });

    it('cannot create twice for existing pool', async () => {
      const tokenFactory = await ethers.getContractFactory('TestERC20');
      const token0 = await tokenFactory.deploy(1337);
      const token1 = await tokenFactory.deploy(1337);

      const poolAddress = await mockAlgebraFactory.createPool.staticCall(token0, token1);
      await mockAlgebraFactory.createPool(token0, token1)

      const mockPoolFactory = await ethers.getContractFactory('MockPool');
      const mockPool = (await mockPoolFactory.attach(poolAddress)) as any as MockPool;
      mockPool.setPluginFactory(pluginFactory);

      await mockAlgebraFactory.stubPool(token0, token1, mockPool);

      await mockAlgebraFactory.grantRole(ethers.keccak256(ethers.toUtf8Bytes("POOLS_ADMINISTRATOR")), pluginFactory);
      await mockAlgebraFactory.grantRole(ethers.keccak256(ethers.toUtf8Bytes("ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR")), pluginFactory);

      await pluginFactory.createPluginForExistingPool(token0, token1);

      await expect(pluginFactory.createPluginForExistingPool(token0, token1)).to.be.revertedWith('Already created');
    });
  });

  describe('#Default fee configuration', () => {
    describe('#setDefaultFeeConfiguration', () => {
      const configuration = {
        alpha1: 3002,
        alpha2: 10009,
        beta1: 1001,
        beta2: 1006,
        gamma1: 20,
        gamma2: 22,
        baseFee: 150,
      };
      it('fails if caller is not owner', async () => {
        await expect(mockDynamicFeeModuleFactory.connect(other).setDefaultFeeConfiguration(configuration)).to.be.revertedWith('Only administrator');
      });

      it('updates defaultFeeConfiguration', async () => {
        await mockDynamicFeeModuleFactory.setDefaultFeeConfiguration(configuration);

        const newConfig = await mockDynamicFeeModuleFactory.defaultFeeConfiguration();

        expect(newConfig.alpha1).to.eq(configuration.alpha1);
        expect(newConfig.alpha2).to.eq(configuration.alpha2);
        expect(newConfig.beta1).to.eq(configuration.beta1);
        expect(newConfig.beta2).to.eq(configuration.beta2);
        expect(newConfig.gamma1).to.eq(configuration.gamma1);
        expect(newConfig.gamma2).to.eq(configuration.gamma2);
        expect(newConfig.baseFee).to.eq(configuration.baseFee);
      });

      it('emits event', async () => {
        await expect(mockDynamicFeeModuleFactory.setDefaultFeeConfiguration(configuration))
          .to.emit(mockDynamicFeeModuleFactory, 'DefaultFeeConfiguration')
          .withArgs([
            configuration.alpha1,
            configuration.alpha2,
            configuration.beta1,
            configuration.beta2,
            configuration.gamma1,
            configuration.gamma2,
            configuration.baseFee,
          ]);
      });

      it('cannot exceed max fee', async () => {
        const conf2 = { ...configuration };
        conf2.alpha1 = 30000;
        conf2.alpha2 = 30000;
        conf2.baseFee = 15000;
        await expect(mockDynamicFeeModuleFactory.setDefaultFeeConfiguration(conf2)).to.be.revertedWith('Max fee exceeded');
      });

      it('cannot set zero gamma', async () => {
        let conf2 = { ...configuration };
        conf2.gamma1 = 0;
        await expect(mockDynamicFeeModuleFactory.setDefaultFeeConfiguration(conf2)).to.be.revertedWith('Gammas must be > 0');

        conf2 = { ...configuration };
        conf2.gamma2 = 0;
        await expect(mockDynamicFeeModuleFactory.setDefaultFeeConfiguration(conf2)).to.be.revertedWith('Gammas must be > 0');

        conf2 = { ...configuration };
        conf2.gamma1 = 0;
        conf2.gamma2 = 0;
        await expect(mockDynamicFeeModuleFactory.setDefaultFeeConfiguration(conf2)).to.be.revertedWith('Gammas must be > 0');
      });
    });
  });

  describe('#setFarmingAddress', () => {
    it('fails if caller is not owner', async () => {
      await expect(farmingModuleFactory.connect(other).setFarmingAddress(wallet.address)).to.be.revertedWith('Only administrator');
    });

    it('updates farmingAddress', async () => {
      await farmingModuleFactory.setFarmingAddress(other.address);
      expect(await farmingModuleFactory.farmingAddress()).to.eq(other.address);
    });

    it('emits event', async () => {
      await expect(farmingModuleFactory.setFarmingAddress(other.address)).to.emit(farmingModuleFactory, 'FarmingAddress').withArgs(other.address);
    });

    it('cannot set current address', async () => {
      await farmingModuleFactory.setFarmingAddress(other.address);
      await expect(farmingModuleFactory.setFarmingAddress(other.address)).to.be.reverted;
    });
  });
});
