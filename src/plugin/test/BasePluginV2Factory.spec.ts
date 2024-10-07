import { Wallet } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from './shared/expect';
import { ZERO_ADDRESS, pluginFactoryFixtureV2 } from './shared/fixtures';

import { BasePluginV2Factory, AlgebraBasePluginV2, MockFactory } from '../typechain';

describe('BasePluginV2Factory', () => {
  let wallet: Wallet, other: Wallet;

  let pluginFactory: BasePluginV2Factory;
  let mockAlgebraFactory: MockFactory;

  before('prepare signers', async () => {
    [wallet, other] = await (ethers as any).getSigners();
  });

  beforeEach('deploy test volatilityOracle', async () => {
    ({ pluginFactory, mockFactory: mockAlgebraFactory } = await loadFixture(pluginFactoryFixtureV2));
  });

  describe('#Create plugin', () => {
    it('only factory', async () => {
      expect(pluginFactory.beforeCreatePoolHook(wallet.address, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, '0x')).to.be
        .revertedWithoutReason;
    });

    it('factory can create plugin', async () => {
      const pluginFactoryFactory = await ethers.getContractFactory('BasePluginV2Factory');
      const pluginFactoryMock = (await pluginFactoryFactory.deploy(wallet.address)) as any as BasePluginV2Factory;

      const pluginAddress = await pluginFactoryMock.beforeCreatePoolHook.staticCall(
        wallet.address,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        '0x'
      );
      await pluginFactoryMock.beforeCreatePoolHook(wallet.address, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, '0x');

      const pluginMock = (await ethers.getContractFactory('AlgebraBasePluginV2')).attach(pluginAddress) as any as AlgebraBasePluginV2;
      const baseFee = await pluginMock.s_baseFee();
      expect(baseFee).to.be.not.eq(0);
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
      await mockAlgebraFactory.stubPool(wallet.address, other.address, other.address);

      await pluginFactory.createPluginForExistingPool(wallet.address, other.address);
      const pluginAddress = await pluginFactory.pluginByPool(other.address);
      expect(pluginAddress).to.not.be.eq(ZERO_ADDRESS);
      const pluginMock = (await ethers.getContractFactory('AlgebraBasePluginV2')).attach(pluginAddress) as any as AlgebraBasePluginV2;
      const baseFee = await pluginMock.s_baseFee();
      expect(baseFee).to.be.not.eq(0);
    });

    it('cannot create twice for existing pool', async () => {
      await mockAlgebraFactory.stubPool(wallet.address, other.address, other.address);

      await pluginFactory.createPluginForExistingPool(wallet.address, other.address);

      await expect(pluginFactory.createPluginForExistingPool(wallet.address, other.address)).to.be.revertedWith('Already created');
    });
  });

  describe('#Default base fee ', () => {
    describe('#setDefaultBaseFee', () => {

      it('fails if caller is not owner', async () => {
        await expect(pluginFactory.connect(other).setDefaultBaseFee(1000)).to.be.revertedWith('Only administrator');
      });

      it('fails if try to set same value', async () => {
        await expect(pluginFactory.connect(other).setDefaultBaseFee(500)).to.be.reverted;
      });

      it('updates defaultFeeConfiguration', async () => {
        await pluginFactory.setDefaultBaseFee(1000);

        const newFee = await pluginFactory.defaultBaseFee();

        expect(newFee).to.eq(1000);
      });

      it('emits event', async () => {
        await expect(pluginFactory.setDefaultBaseFee(1000))
          .to.emit(pluginFactory, 'DefaultBaseFee')
          .withArgs(1000);
      });

    });
  });

  describe('#setFarmingAddress', () => {
    it('fails if caller is not owner', async () => {
      await expect(pluginFactory.connect(other).setFarmingAddress(wallet.address)).to.be.revertedWith('Only administrator');
    });

    it('updates farmingAddress', async () => {
      await pluginFactory.setFarmingAddress(other.address);
      expect(await pluginFactory.farmingAddress()).to.eq(other.address);
    });

    it('emits event', async () => {
      await expect(pluginFactory.setFarmingAddress(other.address)).to.emit(pluginFactory, 'FarmingAddress').withArgs(other.address);
    });

    it('cannot set current address', async () => {
      await pluginFactory.setFarmingAddress(other.address);
      await expect(pluginFactory.setFarmingAddress(other.address)).to.be.reverted;
    });
  });
});
