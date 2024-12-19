import { Wallet, ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from './shared/expect';
import { pluginFixture } from './shared/fixtures';
import { encodePriceSqrt,} from './shared/utilities';

import { MockPool, BasePluginV1Factory, AlgebraBasePluginV1 , MockFactory} from '../typechain';


describe('Withdrawal fee plugin', () => {
  let wallet: Wallet, other: Wallet;

  let plugin: AlgebraBasePluginV1; // modified plugin
  let mockPool: MockPool; // mock of AlgebraPool
  let pluginFactory: BasePluginV1Factory;
  let mockFactory: MockFactory;

  async function initializeAtZeroTick(pool: MockPool) {
    await pool.initialize(encodePriceSqrt(1, 1));
  }

  before('prepare signers', async () => {
    [wallet, other] = await (ethers as any).getSigners();
  });

  beforeEach('deploy test AlgebraBasePluginV1', async () => {
    ({ mockPool, mockFactory } = await loadFixture(pluginFixture));

    const pluginFactoryFactory = await ethers.getContractFactory('BasePluginV1Factory');
    pluginFactory = (await pluginFactoryFactory.deploy(mockFactory)) as any as BasePluginV1Factory;

    await mockFactory.stubPool(ZeroAddress, ZeroAddress, mockPool)

    await pluginFactory.createPluginForExistingPool(ZeroAddress, ZeroAddress)

    let pluginAddress = await pluginFactory.pluginByPool(mockPool)
    const pluginF = await ethers.getContractFactory('AlgebraBasePluginV1');
    plugin = pluginF.attach(pluginAddress) as any as AlgebraBasePluginV1;

    await mockPool.setPlugin(plugin);
    initializeAtZeroTick(mockPool);

  });

  describe('add entrypoint', async () => {
    it('works correct', async () => {
      await pluginFactory.addModifyLiquidityEntrypoint(wallet.address);
      await expect(await pluginFactory.modifyLiquidityEntryPointsStatuses(wallet.address)).to.be.eq(true)
    });

    it('only owner', async () => {
      await expect(pluginFactory.connect(other).addModifyLiquidityEntrypoint(wallet.address)).to.be.reverted;
    });

    it('revert if added yet', async () => {
      await pluginFactory.addModifyLiquidityEntrypoint(wallet.address);
      await expect(pluginFactory.connect(wallet).addModifyLiquidityEntrypoint(wallet.address)).to.be.reverted;
    });
  })

  describe('remove entrypoint', async () => {
    it('works correct', async () => {
      await pluginFactory.addModifyLiquidityEntrypoint(wallet.address);
      await pluginFactory.removeModifyLiquidityEntrypoint(wallet.address);
      await expect(await pluginFactory.modifyLiquidityEntryPointsStatuses(wallet.address)).to.be.eq(false)
    });

    it('only owner', async () => {
      await expect(pluginFactory.connect(other).removeModifyLiquidityEntrypoint(wallet.address)).to.be.reverted;
    });

    it('revert if entrypoint not added before', async () => {
      await expect(pluginFactory.connect(wallet).removeModifyLiquidityEntrypoint(wallet.address)).to.be.reverted;
    });
  })

  describe('withdrawal plugin', async () => {
    it('mint fails if address not added to entrypoint list', async () => {
      await expect(mockPool.mint(ZeroAddress, other, -60, 60, 1000, '0x')).to.be.reverted;
    });

    it('mint fails if address removed from entrypoint list', async () => {
      await pluginFactory.addModifyLiquidityEntrypoint(wallet.address);
      await expect(mockPool.mint(ZeroAddress, other, -60, 60, 1000, '0x')).to.not.be.reverted;
      await pluginFactory.removeModifyLiquidityEntrypoint(wallet.address);
      await expect(mockPool.mint(ZeroAddress, other, -60, 60, 1000, '0x')).to.be.reverted;
    });

    it('mint works if address added to entrypoint list', async () => {
      await pluginFactory.addModifyLiquidityEntrypoint(wallet.address);
      await expect(mockPool.mint(ZeroAddress, other, -60, 60, 1000, '0x')).to.not.be.reverted;
      await expect(mockPool.connect(other).mint(ZeroAddress, other, -60, 60, 1000, '0x')).to.be.reverted;
    });

    it('mint works with few addresses added to entrypoint list', async () => {
      await pluginFactory.addModifyLiquidityEntrypoint(wallet.address);
      await pluginFactory.addModifyLiquidityEntrypoint(other.address);
      await expect(mockPool.mint(ZeroAddress, other, -60, 60, 1000, '0x')).to.not.be.reverted;
      await expect(mockPool.mint(ZeroAddress, other, -60, 60, 1000, '0x')).to.not.be.reverted;
    });

    it('burn fails if address removed from entrypoint list', async () => {
      await pluginFactory.addModifyLiquidityEntrypoint(wallet.address);
      await expect(mockPool.burn(-60, 60, 1000, '0x')).to.not.be.reverted;
      await pluginFactory.removeModifyLiquidityEntrypoint(wallet.address);
      await expect(mockPool.burn( -60, 60, 1000, '0x')).to.be.reverted;
    });
  })

});