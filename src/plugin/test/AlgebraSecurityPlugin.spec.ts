import { Wallet, ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from './shared/expect';
import { securityPluginFixture } from './shared/fixtures';
import { PLUGIN_FLAGS, encodePriceSqrt, expandTo18Decimals, getMaxTick, getMinTick } from './shared/utilities';

import { MockPool, AlgebraSecurityPlugin, SecurityPluginFactory, SecurityRegistry, MockFactory } from '../typechain';

import snapshotGasCost from './shared/snapshotGasCost';

describe('AlgebraSecurityPlugin', () => {
  let wallet: Wallet, other: Wallet;

  let plugin: AlgebraSecurityPlugin; 
  let mockPool: MockPool; // mock of AlgebraPool
  let pluginFactory: SecurityPluginFactory;
  let registry: SecurityRegistry;
  let mockFactory: MockFactory;
  async function initializeAtZeroTick(pool: MockPool) {
    await pool.initialize(encodePriceSqrt(1, 1));
  }

  before('prepare signers', async () => {
    [wallet, other] = await (ethers as any).getSigners();
  });

  beforeEach('deploy test AlgebaraSecurityPlugin', async () => {
    ({ plugin, mockPool, pluginFactory, registry, mockFactory } = await loadFixture(securityPluginFixture));
  });

  // plain tests for hooks functionality
  describe('#Hooks', () => {
    it('only pool can call hooks', async () => {
      const errorMessage = 'Only pool can call this';
      await expect(plugin.beforeInitialize(wallet.address, 100)).to.be.revertedWith(errorMessage);
      await expect(plugin.afterInitialize(wallet.address, 100, 100)).to.be.revertedWith(errorMessage);
      await expect(plugin.beforeModifyPosition(wallet.address, wallet.address, 100, 100, 100, '0x')).to.be.revertedWith(errorMessage);
      await expect(plugin.afterModifyPosition(wallet.address, wallet.address, 100, 100, 100, 100, 100, '0x')).to.be.revertedWith(errorMessage);
      await expect(plugin.beforeSwap(wallet.address, wallet.address, true, 100, 100, false, '0x')).to.be.revertedWith(errorMessage);
      await expect(plugin.afterSwap(wallet.address, wallet.address, true, 100, 100, 100, 100, '0x')).to.be.revertedWith(errorMessage);
      await expect(plugin.beforeFlash(wallet.address, wallet.address, 100, 100, '0x')).to.be.revertedWith(errorMessage);
      await expect(plugin.afterFlash(wallet.address, wallet.address, 100, 100, 100, 100, '0x')).to.be.revertedWith(errorMessage);
    });

    describe('not implemented hooks', async () => {
      let defaultConfig: bigint;

      beforeEach('connect plugin to pool', async () => {
        defaultConfig = await plugin.defaultPluginConfig();
        await mockPool.setPlugin(plugin);
      });

      it('resets config after afterSwap', async () => {
        await mockPool.initialize(encodePriceSqrt(1, 1));
        await mockPool.setPluginConfig(PLUGIN_FLAGS.AFTER_SWAP_FLAG);
        expect((await mockPool.globalState()).pluginConfig).to.be.eq(PLUGIN_FLAGS.AFTER_SWAP_FLAG);
        await mockPool.swapToTick(10);
        expect((await mockPool.globalState()).pluginConfig).to.be.eq(defaultConfig);
      });

      it('resets config after afterModifyPosition', async () => {
        await mockPool.initialize(encodePriceSqrt(1, 1));
        await mockPool.setPluginConfig(PLUGIN_FLAGS.AFTER_POSITION_MODIFY_FLAG);
        expect((await mockPool.globalState()).pluginConfig).to.be.eq(PLUGIN_FLAGS.AFTER_POSITION_MODIFY_FLAG);
        await mockPool.mint(wallet.address, wallet.address, 0, 60, 100, '0x');
        expect((await mockPool.globalState()).pluginConfig).to.be.eq(defaultConfig);
      });

      it('resets config after afterFlash', async () => {
        await mockPool.setPluginConfig(PLUGIN_FLAGS.AFTER_FLASH_FLAG);
        expect((await mockPool.globalState()).pluginConfig).to.be.eq(PLUGIN_FLAGS.AFTER_FLASH_FLAG);
        await mockPool.flash(wallet.address, 100, 100, '0x');
        expect((await mockPool.globalState()).pluginConfig).to.be.eq(defaultConfig);
      });
    });

  });

  describe('#SecurityPlugin', () => {
    let defaultConfig: bigint;

    beforeEach('initialize pool', async () => {
      defaultConfig = await plugin.defaultPluginConfig();
      await mockPool.setPlugin(plugin);
      await mockPool.initialize(encodePriceSqrt(1, 1));
    });

    describe('ENABLE status', async () => {
      it('works correct', async () => {
        await expect(mockPool.swapToTick(10)).to.not.be.reverted;
        await expect(mockPool.mint(wallet.address, wallet.address, 0, 60, 100, '0x')).not.to.be.reverted;
        await expect(mockPool.burn(0, 60, 1000, '0x')).not.to.be.reverted; 
        await expect(mockPool.flash(wallet.address, 100, 100, '0x')).not.to.be.reverted; 
        expect((await mockPool.globalState()).pluginConfig).to.be.eq(defaultConfig);
      });
    });

    describe('BURN_ONLY status', async () => {
      it('works correct', async () => {
        await registry.setGlobalStatus(1)
        await expect(mockPool.swapToTick(10)).to.be.revertedWithCustomError(plugin,'BurnOnly'); 
        await expect(mockPool.mint(wallet.address, wallet.address, 0, 60, 100, '0x')).to.be.revertedWithCustomError(plugin,'BurnOnly'); 
        await expect(mockPool.burn(0, 60, 1000, '0x')).to.not.be.reverted;
        await expect(mockPool.flash(wallet.address, 100, 100, '0x')).to.be.revertedWithCustomError(plugin,'BurnOnly'); 
        expect((await mockPool.globalState()).pluginConfig).to.be.eq(defaultConfig);
      });
    });

    describe('DISABLED status', async () => {
      it('works correct', async () => {
        await registry.setGlobalStatus(2)
        await expect(mockPool.swapToTick(10)).to.be.revertedWithCustomError(plugin,'PoolDisabled');
        await expect(mockPool.mint(wallet.address, wallet.address, 0, 60, 100, '0x')).to.be.revertedWithCustomError(plugin,'PoolDisabled');
        await expect(mockPool.burn(0, 60, 1000, '0x')).to.be.revertedWithCustomError(plugin,'PoolDisabled');
        await expect(mockPool.flash(wallet.address, 100, 100, '0x')).to.be.revertedWithCustomError(plugin,'PoolDisabled');
        expect((await mockPool.globalState()).pluginConfig).to.be.eq(defaultConfig);

      });
    });
  })

  describe('AlgebaraSecurityPlugin external methods', () => {
     
    it('set registry contract works correct', async () => {
      await plugin.setSecurityRegistry(ZeroAddress);
      await expect(plugin.setSecurityRegistry(registry)).to.emit(plugin, 'SecurityRegistry');
      expect(await plugin.getSecurityRegistry()).to.be.eq(registry);
    });

    it('only owner can set registry address', async () => {
      await expect(plugin.connect(other).setSecurityRegistry(ZeroAddress)).to.be.reverted;
    });

  });

  describe('#SecurtityRegistry', () => {

    describe('#setPoolStatus', async () => {
      it('works correct', async () => {
        await registry.setPoolsStatus([mockPool], [1]);
        expect(await registry.poolStatus(mockPool)).to.be.eq(1);
        await registry.setPoolsStatus([mockPool], [2]);
        expect(await registry.poolStatus(mockPool)).to.be.eq(2);
        await registry.setPoolsStatus([mockPool], [0]);
        expect(await registry.poolStatus(mockPool)).to.be.eq(0);
      });

      it('add few pools updates isPoolStatusOverrided var', async () => {
        await registry.setPoolsStatus([mockPool, wallet], [1, 1]);
        expect(await registry.isPoolStatusOverrided()).to.be.eq(true);
        await registry.setPoolsStatus([mockPool, wallet], [1, 1]);
        await registry.setPoolsStatus([mockPool, wallet], [0, 0]);
        expect(await registry.isPoolStatusOverrided()).to.be.eq(false);
        await registry.setPoolsStatus([mockPool, wallet], [1, 1]);
        await registry.setPoolsStatus([mockPool, wallet], [0, 1]);
        expect(await registry.isPoolStatusOverrided()).to.be.eq(true);

      });

      it('only owner can set all pool status', async () => {
        await expect(registry.connect(other).setPoolsStatus([mockPool], [1])).to.be.reverted
        await mockFactory.grantRole(await registry.GUARD(), other.address);
        await expect(registry.connect(other).setPoolsStatus([mockPool], [0])).to.be.reverted
        await expect(registry.connect(other).setPoolsStatus([mockPool], [1])).to.be.reverted
      });

      it('address with guard role can set DISABLED pool status', async () => {
        await mockFactory.grantRole(await registry.GUARD(), other.address);
        await expect(registry.connect(other).setPoolsStatus([mockPool], [2])).to.emit(registry, 'PoolStatus');
        expect(await registry.poolStatus(mockPool)).to.be.eq(2);
      });
    });


    describe('#setGlobalStatus', async () => {
        it('works correct', async () => {
          await registry.setGlobalStatus(1);
          expect(await registry.globalStatus()).to.be.eq(1);
          await registry.setGlobalStatus(2);
          expect(await registry.globalStatus()).to.be.eq(2);
          await registry.setGlobalStatus(0);
          expect(await registry.globalStatus()).to.be.eq(0);
        });

        it('only owner can set all pool status', async () => {
          await expect(registry.connect(other).setGlobalStatus(1)).to.be.reverted
          await mockFactory.grantRole(await registry.GUARD(), other.address);
          await expect(registry.connect(other).setGlobalStatus(1)).to.be.reverted
          await expect(registry.connect(other).setGlobalStatus(0)).to.be.reverted
        });

        it('address with guard role can set DISABLED pool status', async () => {
          await mockFactory.grantRole(await registry.GUARD(), other.address);
          await expect(registry.connect(other).setGlobalStatus(2)).to.emit(registry, 'GlobalStatus');
          expect(await registry.globalStatus()).to.be.eq(2);
        });
    });

    describe('#getPoolStatus', async () => {
      it('pool status overrides global status, if global status is ENABLED ', async () => {
        await registry.setGlobalStatus(0);
        await registry.setPoolsStatus([mockPool], [1]);
        expect(await registry.getPoolStatus(mockPool)).to.be.eq(1);

        await registry.setGlobalStatus(0);
        await registry.setPoolsStatus([mockPool], [2]);
        expect(await registry.getPoolStatus(mockPool)).to.be.eq(2);
      });

      it('global status overrides pool status, if global status is BURN_ONLY or DISABLED ', async () => {
        await registry.setGlobalStatus(2);
        await registry.setPoolsStatus([mockPool], [1]);
        expect(await registry.getPoolStatus(mockPool)).to.be.eq(2);

        await registry.setGlobalStatus(1);
        await registry.setPoolsStatus([mockPool], [2]);
        expect(await registry.getPoolStatus(mockPool)).to.be.eq(1);
      });

  });
  });
});
