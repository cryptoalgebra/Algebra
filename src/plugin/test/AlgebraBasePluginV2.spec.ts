import { Wallet, ZeroAddress } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import checkTimepointEquals from './shared/checkTimepointEquals';
import { expect } from './shared/expect';
import { TEST_POOL_START_TIME, pluginFixtureV2 } from './shared/fixtures';
import { PLUGIN_FLAGS, encodePriceSqrt, expandTo18Decimals, getMaxTick, getMinTick } from './shared/utilities';

import { MockPool, MockTimeAlgebraBasePluginV2, MockTimeDSFactoryV2, MockTimeVirtualPool } from '../typechain';

import snapshotGasCost from './shared/snapshotGasCost';

describe('AlgebraBasePluginV2', () => {
  let wallet: Wallet, other: Wallet;

  let plugin: MockTimeAlgebraBasePluginV2; // modified plugin
  let mockPool: MockPool; // mock of AlgebraPool
  let mockPluginFactory: MockTimeDSFactoryV2; // modified plugin factory

  let minTick = getMinTick(60);
  let maxTick = getMaxTick(60);

  async function initializeAtZeroTick(pool: MockPool) {
    await pool.initialize(encodePriceSqrt(1, 1));
  }

  before('prepare signers', async () => {
    [wallet, other] = await (ethers as any).getSigners();
  });

  beforeEach('deploy test AlgebraBasePluginV2', async () => {
    ({ plugin, mockPool, mockPluginFactory} = await loadFixture(pluginFixtureV2));
  });

  describe('#Initialize', async () => {
    it('cannot initialize twice', async () => {
      await mockPool.setPlugin(plugin);
      await initializeAtZeroTick(mockPool);

      await expect(plugin.initialize()).to.be.revertedWith('Already initialized');
    });

    it('cannot initialize detached plugin', async () => {
      await initializeAtZeroTick(mockPool);
      await expect(plugin.initialize()).to.be.revertedWith('Plugin not attached');
    });

    it('cannot initialize if pool not initialized', async () => {
      await mockPool.setPlugin(plugin);
      await expect(plugin.initialize()).to.be.revertedWith('Pool is not initialized');
    });

    it('can initialize for existing pool', async () => {
      await initializeAtZeroTick(mockPool);
      await mockPool.setPlugin(plugin);
      await plugin.initialize();

      const timepoint = await plugin.timepoints(0);
      expect(timepoint.initialized).to.be.true;
    });

    it('can not write to uninitialized oracle', async () => {
      await initializeAtZeroTick(mockPool);
      await mockPool.setPlugin(plugin);
      await mockPool.setPluginConfig(1); // BEFORE_SWAP_FLAG

      await expect(mockPool.swapToTick(5)).to.be.revertedWith('Not initialized');
    });
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

      it('resets config after beforeModifyPosition', async () => {
        await mockPool.initialize(encodePriceSqrt(1, 1));
        await mockPool.setPluginConfig(PLUGIN_FLAGS.BEFORE_POSITION_MODIFY_FLAG);
        expect((await mockPool.globalState()).pluginConfig).to.be.eq(PLUGIN_FLAGS.BEFORE_POSITION_MODIFY_FLAG);
        await mockPool.mint(wallet.address, wallet.address, 0, 60, 100, '0x');
        expect((await mockPool.globalState()).pluginConfig).to.be.eq(defaultConfig);
      });

      it('resets config after afterModifyPosition', async () => {
        await mockPool.initialize(encodePriceSqrt(1, 1));
        await mockPool.setPluginConfig(PLUGIN_FLAGS.AFTER_POSITION_MODIFY_FLAG);
        expect((await mockPool.globalState()).pluginConfig).to.be.eq(PLUGIN_FLAGS.AFTER_POSITION_MODIFY_FLAG);
        await mockPool.mint(wallet.address, wallet.address, 0, 60, 100, '0x');
        expect((await mockPool.globalState()).pluginConfig).to.be.eq(defaultConfig);
      });

      it('resets config after beforeFlash', async () => {
        await mockPool.setPluginConfig(PLUGIN_FLAGS.BEFORE_FLASH_FLAG);
        expect((await mockPool.globalState()).pluginConfig).to.be.eq(PLUGIN_FLAGS.BEFORE_FLASH_FLAG);
        await mockPool.flash(wallet.address, 100, 100, '0x');
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

  describe('#VolatilityVolatilityOracle', () => {
    beforeEach('connect plugin to pool', async () => {
      await mockPool.setPlugin(plugin);
    });

    it('initializes timepoints slot', async () => {
      await initializeAtZeroTick(mockPool);
      checkTimepointEquals(await plugin.timepoints(0), {
        initialized: true,
        blockTimestamp: BigInt(TEST_POOL_START_TIME),
        tickCumulative: 0n,
      });
    });

    describe('#getTimepoints', () => {
      beforeEach(async () => await initializeAtZeroTick(mockPool));

      // zero tick
      it('current tick accumulator increases by tick over time', async () => {
        let {
          tickCumulatives: [tickCumulative],
        } = await plugin.getTimepoints([0]);
        expect(tickCumulative).to.eq(0);
        await plugin.advanceTime(10);
        ({
          tickCumulatives: [tickCumulative],
        } = await plugin.getTimepoints([0]));
        expect(tickCumulative).to.eq(0);
      });

      it('current tick accumulator after single swap', async () => {
        // moves to tick -1
        await mockPool.swapToTick(-1);

        await plugin.advanceTime(4);
        let {
          tickCumulatives: [tickCumulative],
        } = await plugin.getTimepoints([0]);
        expect(tickCumulative).to.eq(-4);
      });

      it('current tick accumulator after swaps', async () => {
        await mockPool.swapToTick(-4463);
        expect((await mockPool.globalState()).tick).to.eq(-4463);
        await plugin.advanceTime(4);
        await mockPool.swapToTick(-1560);
        expect((await mockPool.globalState()).tick).to.eq(-1560);
        let {
          tickCumulatives: [tickCumulative0],
        } = await plugin.getTimepoints([0]);
        expect(tickCumulative0).to.eq(-17852);
        await plugin.advanceTime(60 * 5);
        await mockPool.swapToTick(-1561);
        let {
          tickCumulatives: [tickCumulative1],
        } = await plugin.getTimepoints([0]);
        expect(tickCumulative1).to.eq(-485852);
      });
    });

    it('writes an timepoint', async () => {
      await initializeAtZeroTick(mockPool);
      checkTimepointEquals(await plugin.timepoints(0), {
        tickCumulative: 0n,
        blockTimestamp: BigInt(TEST_POOL_START_TIME),
        initialized: true,
      });
      await plugin.advanceTime(1);
      await mockPool.swapToTick(10);
      checkTimepointEquals(await plugin.timepoints(1), {
        tickCumulative: 0n,
        blockTimestamp: BigInt(TEST_POOL_START_TIME + 1),
        initialized: true,
      });
    });

    it('does not write an timepoint', async () => {
      await initializeAtZeroTick(mockPool);
      checkTimepointEquals(await plugin.timepoints(0), {
        tickCumulative: 0n,
        blockTimestamp: BigInt(TEST_POOL_START_TIME),
        initialized: true,
      });
      await plugin.advanceTime(1);
      await mockPool.mint(wallet.address, wallet.address, -240, 0, 100, '0x');
      checkTimepointEquals(await plugin.timepoints(0), {
        tickCumulative: 0n,
        blockTimestamp: BigInt(TEST_POOL_START_TIME),
        initialized: true,
      });
    });

    describe('#getSingleTimepoint', () => {
      beforeEach(async () => await initializeAtZeroTick(mockPool));

      // zero tick
      it('current tick accumulator increases by tick over time', async () => {
        let { tickCumulative } = await plugin.getSingleTimepoint(0);
        expect(tickCumulative).to.eq(0);
        await plugin.advanceTime(10);
        ({ tickCumulative } = await plugin.getSingleTimepoint(0));
        expect(tickCumulative).to.eq(0);
      });

      it('current tick accumulator after single swap', async () => {
        // moves to tick -1
        await mockPool.swapToTick(-1);

        await plugin.advanceTime(4);
        let { tickCumulative } = await plugin.getSingleTimepoint(0);
        expect(tickCumulative).to.eq(-4);
      });

      it('current tick accumulator after swaps', async () => {
        await mockPool.swapToTick(-4463);
        expect((await mockPool.globalState()).tick).to.eq(-4463);
        await plugin.advanceTime(4);
        await mockPool.swapToTick(-1560);
        expect((await mockPool.globalState()).tick).to.eq(-1560);
        let { tickCumulative: tickCumulative0 } = await plugin.getSingleTimepoint(0);
        expect(tickCumulative0).to.eq(-17852);
        await plugin.advanceTime(60 * 5);
        await mockPool.swapToTick(-1561);
        let { tickCumulative: tickCumulative1 } = await plugin.getSingleTimepoint(0);
        expect(tickCumulative1).to.eq(-485852);
      });
    });

    describe('#prepayTimepointsStorageSlots', () => {
      it('can prepay', async () => {
        await plugin.prepayTimepointsStorageSlots(0, 50);
      });

      it('can prepay with space', async () => {
        await plugin.prepayTimepointsStorageSlots(10, 50);
      });

      it('writes after swap, prepaid after init', async () => {
        await initializeAtZeroTick(mockPool);
        await plugin.prepayTimepointsStorageSlots(1, 1);
        expect((await plugin.timepoints(1)).blockTimestamp).to.be.eq(1);
        await mockPool.swapToTick(-4463);
        expect((await mockPool.globalState()).tick).to.eq(-4463);
        await plugin.advanceTime(4);
        await mockPool.swapToTick(-1560);
        expect((await plugin.timepoints(1)).blockTimestamp).to.be.not.eq(1);
        expect((await mockPool.globalState()).tick).to.eq(-1560);
        let { tickCumulative: tickCumulative0 } = await plugin.getSingleTimepoint(0);
        expect(tickCumulative0).to.eq(-17852);
      });

      it('writes after swap, prepaid before init', async () => {
        await plugin.prepayTimepointsStorageSlots(0, 2);
        await initializeAtZeroTick(mockPool);
        expect((await plugin.timepoints(1)).blockTimestamp).to.be.eq(1);
        await mockPool.swapToTick(-4463);
        expect((await mockPool.globalState()).tick).to.eq(-4463);
        await plugin.advanceTime(4);
        await mockPool.swapToTick(-1560);
        expect((await plugin.timepoints(1)).blockTimestamp).to.be.not.eq(1);
        expect((await mockPool.globalState()).tick).to.eq(-1560);
        let { tickCumulative: tickCumulative0 } = await plugin.getSingleTimepoint(0);
        expect(tickCumulative0).to.eq(-17852);
      });

      describe('failure cases', async () => {
        it('cannot rewrite initialized slot', async () => {
          await initializeAtZeroTick(mockPool);
          await expect(plugin.prepayTimepointsStorageSlots(0, 2)).to.be.reverted;
          await plugin.advanceTime(4);
          await mockPool.swapToTick(-1560);
          await expect(plugin.prepayTimepointsStorageSlots(1, 2)).to.be.reverted;
          await expect(plugin.prepayTimepointsStorageSlots(2, 2)).to.be.not.reverted;
        });

        it('cannot prepay 0 slots', async () => {
          await expect(plugin.prepayTimepointsStorageSlots(0, 0)).to.be.revertedWithoutReason;
        });

        it('cannot overflow index', async () => {
          await plugin.prepayTimepointsStorageSlots(0, 10);
          expect(plugin.prepayTimepointsStorageSlots(11, 2n ** 16n - 5n)).to.be.revertedWithoutReason;
          expect(plugin.prepayTimepointsStorageSlots(11, 2n ** 16n)).to.be.revertedWithoutReason;
        });
      });
    });
  });

  describe('#SlidingFee', () => {

      beforeEach('initialize pool', async () => {
        await mockPool.setPlugin(plugin);
        await initializeAtZeroTick(mockPool);
      });

      describe('#setPriceChangeFactor', () => {
        it('works correct', async () => {
          await plugin.setPriceChangeFactor(1500)
          let factor = await plugin.s_priceChangeFactor()
          expect(factor).to.be.equal(1500);
        });

        it('emit event', async () => {
          await expect(plugin.setPriceChangeFactor(1500)).to.emit(plugin, "PriceChangeFactor");
        });

        it('fails if caller is not owner or manager', async () => {
          await expect(plugin.connect(other).setPriceChangeFactor(1500)).to.be.reverted;
        });
      })

      describe('#setBaseFee', () => {
        it('works correct', async () => {
          await plugin.setBaseFee(1500)
          let baseFee = await plugin.s_baseFee()
          expect(baseFee).to.be.equal(1500);
        });

        it('emit event', async () => {
          await expect(plugin.setBaseFee(1500)).to.emit(plugin, "BaseFee");
        });

        it('fails if caller is not owner or manager', async () => {
          await expect(plugin.connect(other).setBaseFee(1500)).to.be.reverted;
        });
      })
  })

  describe('#FarmingPlugin', () => {
    describe('virtual pool tests', () => {
      let virtualPoolMock: MockTimeVirtualPool;

      beforeEach('deploy virtualPoolMock', async () => {
        await mockPluginFactory.setFarmingAddress(wallet);
        const virtualPoolMockFactory = await ethers.getContractFactory('MockTimeVirtualPool');
        virtualPoolMock = (await virtualPoolMockFactory.deploy()) as any as MockTimeVirtualPool;
      });

      it('returns pool address', async () => {
        expect(await plugin.getPool()).to.be.eq(mockPool);
      });

      it('set incentive works', async () => {
        await mockPool.setPlugin(plugin);
        await plugin.setIncentive(virtualPoolMock);
        expect(await plugin.incentive()).to.be.eq(await virtualPoolMock.getAddress());
      });

      it('can detach incentive', async () => {
        await mockPool.setPlugin(plugin);
        await plugin.setIncentive(virtualPoolMock);
        await plugin.setIncentive(ZeroAddress);
        expect(await plugin.incentive()).to.be.eq(ZeroAddress);
      });

      it('can detach incentive even if no more has rights to connect plugins', async () => {
        await mockPool.setPlugin(plugin);
        await plugin.setIncentive(virtualPoolMock);
        await mockPluginFactory.setFarmingAddress(other);
        await plugin.setIncentive(ZeroAddress);
        expect(await plugin.incentive()).to.be.eq(ZeroAddress);
      });

      it('cannot attach incentive even if no more has rights to connect plugins', async () => {
        await mockPool.setPlugin(plugin);
        await plugin.setIncentive(virtualPoolMock);
        await mockPluginFactory.setFarmingAddress(other);
        await expect(plugin.setIncentive(other)).to.be.revertedWith('Not allowed to set incentive');
      });

      it('new farming can detach old incentive', async () => {
        await mockPool.setPlugin(plugin);
        await plugin.setIncentive(virtualPoolMock);
        await mockPluginFactory.setFarmingAddress(other);
        await plugin.connect(other).setIncentive(ZeroAddress);
        expect(await plugin.incentive()).to.be.eq(ZeroAddress);
      });

      it('cannot detach incentive if nothing connected', async () => {
        await mockPool.setPlugin(plugin);
        await expect(plugin.setIncentive(ZeroAddress)).to.be.revertedWith('Already active');
        expect(await plugin.incentive()).to.be.eq(ZeroAddress);
      });

      it('cannot set same incentive twice', async () => {
        await mockPool.setPlugin(plugin);
        await plugin.setIncentive(virtualPoolMock);
        await expect(plugin.setIncentive(virtualPoolMock)).to.be.revertedWith('Already active');
      });

      it('cannot set incentive if has active', async () => {
        await mockPool.setPlugin(plugin);
        await plugin.setIncentive(virtualPoolMock);
        await expect(plugin.setIncentive(wallet.address)).to.be.revertedWith('Has active incentive');
      });

      it('can detach incentive if not connected to pool', async () => {
        const defaultConfig = await plugin.defaultPluginConfig();
        await mockPool.setPlugin(plugin);
        await mockPool.setPluginConfig(BigInt(PLUGIN_FLAGS.AFTER_SWAP_FLAG) | defaultConfig);
        await plugin.setIncentive(virtualPoolMock);
        expect(await plugin.incentive()).to.be.eq(await virtualPoolMock.getAddress());
        await mockPool.setPlugin(ZeroAddress);
        await plugin.setIncentive(ZeroAddress);
        expect(await plugin.incentive()).to.be.eq(ZeroAddress);
      });

      it('can set incentive if afterSwap hook is active', async () => {
        const defaultConfig = await plugin.defaultPluginConfig();
        await mockPool.setPlugin(plugin);
        await mockPool.setPluginConfig(BigInt(PLUGIN_FLAGS.AFTER_SWAP_FLAG) | defaultConfig);
        await plugin.setIncentive(virtualPoolMock);
        expect(await plugin.incentive()).to.be.eq(await virtualPoolMock.getAddress());
        expect((await mockPool.globalState()).pluginConfig).to.be.eq(BigInt(PLUGIN_FLAGS.AFTER_SWAP_FLAG) | defaultConfig);
      });

      it('set incentive works only for PluginFactory.farmingAddress', async () => {
        await mockPluginFactory.setFarmingAddress(ZeroAddress);
        await expect(plugin.setIncentive(virtualPoolMock)).to.be.revertedWith('Not allowed to set incentive');
      });

      it('incentive can not be attached if plugin is not attached', async () => {
        await expect(plugin.setIncentive(virtualPoolMock)).to.be.revertedWith('Plugin not attached');
      });

      it('incentive attached before initialization', async () => {
        await mockPool.setPlugin(plugin);

        await plugin.setIncentive(virtualPoolMock);
        await mockPool.initialize(encodePriceSqrt(1, 1));
        await mockPool.mint(wallet.address, wallet.address, -120, 120, 1, '0x');
        await mockPool.mint(wallet.address, wallet.address, minTick, maxTick, 1, '0x');

        await mockPool.swapToTick(-130);

        expect(await plugin.incentive()).to.be.eq(await virtualPoolMock.getAddress());
        expect(await plugin.isIncentiveConnected(virtualPoolMock)).to.be.true;

        const tick = (await mockPool.globalState()).tick;
        expect(await virtualPoolMock.currentTick()).to.be.eq(tick);
        expect(await virtualPoolMock.timestamp()).to.be.gt(0);
      });

      it('incentive attached after initialization', async () => {
        await mockPool.setPlugin(plugin);
        await mockPool.initialize(encodePriceSqrt(1, 1));
        await plugin.setIncentive(virtualPoolMock);

        await mockPool.mint(wallet.address, wallet.address, -120, 120, 1, '0x');
        await mockPool.mint(wallet.address, wallet.address, minTick, maxTick, 1, '0x');

        await mockPool.swapToTick(-130);

        expect(await plugin.incentive()).to.be.eq(await virtualPoolMock.getAddress());
        expect(await plugin.isIncentiveConnected(virtualPoolMock)).to.be.true;

        const tick = (await mockPool.globalState()).tick;
        expect(await virtualPoolMock.currentTick()).to.be.eq(tick);
        expect(await virtualPoolMock.timestamp()).to.be.gt(0);
      });

      it.skip('swap with finished incentive', async () => {
        /*await virtualPoolMock.setIsExist(false);
         await mockPool.setIncentive(virtualPoolMock.address);
         await mockPool.initialize(encodePriceSqrt(1, 1));
         await mint(wallet.address, -120, 120, 1);
         await mint(wallet.address, minTick, maxTick, 1);
         expect(await mockPool.activeIncentive()).to.be.eq(virtualPoolMock.address);    
   
         await swapToLowerPrice(encodePriceSqrt(1, 2), wallet.address);
   
         expect(await mockPool.activeIncentive()).to.be.eq(ethers.constants.AddressZero);
         expect(await virtualPoolMock.currentTick()).to.be.eq(0);
         expect(await virtualPoolMock.timestamp()).to.be.eq(0);
         */
      });

      it.skip('swap with not started yet incentive', async () => {
        /*
         await virtualPoolMock.setIsStarted(false);
         await mockPool.setIncentive(virtualPoolMock.address);
         await mockPool.initialize(encodePriceSqrt(1, 1));
         await mint(wallet.address, -120, 120, 1);
         await mint(wallet.address, minTick, maxTick, 1);
         expect(await mockPool.activeIncentive()).to.be.eq(virtualPoolMock.address);    
   
         await swapToLowerPrice(encodePriceSqrt(1, 2), wallet.address);
   
         const tick = (await mockPool.globalState()).tick;
         expect(await mockPool.activeIncentive()).to.be.eq(virtualPoolMock.address);
         expect(await virtualPoolMock.currentTick()).to.be.eq(tick);
         expect(await virtualPoolMock.timestamp()).to.be.eq(0); 
         */
      });
    });

    describe('#isIncentiveConnected', () => {
      let virtualPoolMock: MockTimeVirtualPool;

      beforeEach('deploy virtualPoolMock', async () => {
        await mockPluginFactory.setFarmingAddress(wallet);
        const virtualPoolMockFactory = await ethers.getContractFactory('MockTimeVirtualPool');
        virtualPoolMock = (await virtualPoolMockFactory.deploy()) as any as MockTimeVirtualPool;
      });

      it('true with active incentive', async () => {
        await mockPool.setPlugin(plugin);
        await plugin.setIncentive(virtualPoolMock);
        expect(await plugin.isIncentiveConnected(virtualPoolMock)).to.be.true;
      });

      it('false with invalid address', async () => {
        await mockPool.setPlugin(plugin);
        await plugin.setIncentive(virtualPoolMock);
        expect(await plugin.isIncentiveConnected(wallet.address)).to.be.false;
      });

      it('false if plugin detached', async () => {
        await mockPool.setPlugin(plugin);
        await plugin.setIncentive(virtualPoolMock);
        await mockPool.setPlugin(ZeroAddress);
        expect(await plugin.isIncentiveConnected(virtualPoolMock)).to.be.false;
      });

      it('false if hook deactivated', async () => {
        await mockPool.setPlugin(plugin);
        await plugin.setIncentive(virtualPoolMock);
        await mockPool.setPluginConfig(0);
        expect(await plugin.isIncentiveConnected(virtualPoolMock)).to.be.false;
      });
    });

    describe('#Incentive', () => {
      it('incentive is not detached after swap', async () => {
        await mockPool.setPlugin(plugin);
        await initializeAtZeroTick(mockPool);
        await mockPluginFactory.setFarmingAddress(wallet.address);

        const vpStubFactory = await ethers.getContractFactory('MockTimeVirtualPool');
        let vpStub = (await vpStubFactory.deploy()) as any as MockTimeVirtualPool;

        await plugin.setIncentive(vpStub);
        const initLiquidityAmount = 10000000000n;
        await mockPool.mint(wallet.address, wallet.address, -120, 120, initLiquidityAmount, '0x');
        await mockPool.mint(wallet.address, wallet.address, -1200, 1200, initLiquidityAmount, '0x');
        await mockPool.swapToTick(-200);

        expect(await plugin.incentive()).to.be.eq(await vpStub.getAddress());
      });
    });
  });

});
