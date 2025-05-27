import { Wallet, ZeroAddress } from 'ethers';
import { ethers, network } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import checkTimepointEquals from './shared/checkTimepointEquals';
import { expect } from './shared/expect';
import { TEST_POOL_START_TIME, ZERO_ADDRESS, pluginFixtureALM } from './shared/fixtures';
import { PLUGIN_FLAGS, encodePriceSqrt, expandTo18Decimals, getMaxTick, getMinTick } from './shared/utilities';

import { MockPool, MockAlgebraBasePluginALM, MockAlgebraBasePluginALMFactory, MockTimeVirtualPool, MockVault, RebalanceManager, MockRebalanceManager, MockFactory } from '../typechain';

import snapshotGasCost from './shared/snapshotGasCost';

enum DecideStatus {
  Normal,
  Special,
  NoNeed,
  TooSoon,
  NoNeedWithPending,
  ExtremeVolatility
}

enum State {
  OverInventory,
  Normal,
  UnderInventory,
  Special
}

describe('AlgebraBasePluginALM', () => {
  let wallet: Wallet, other: Wallet;

  let mockVault: MockVault;
  let rebalanceManager: MockRebalanceManager;
  let plugin: MockAlgebraBasePluginALM; // modified plugin
  let mockPluginFactory: MockAlgebraBasePluginALMFactory; // modified plugin factory
  let mockPool: MockPool; // mock of AlgebraPool
  let mockFactory: MockFactory;

  let minTick = getMinTick(60);
  let maxTick = getMaxTick(60);

  const DEFAULT_THRESHOLDS = {
    depositTokenUnusedThreshold: 100,
    simulate: 9400, // было 9300
    normalThreshold: 8100, // было 8000
    underInventoryThreshold: 7800, // было 7700
    overInventoryThreshold: 9100,
    priceChangeThreshold: 50,
    extremeVolatility: 2500,
    highVolatility: 900, // было 500
    someVolatility: 200, // было 100
    dtrDelta: 300,
    baseLowPct: 3000, // было 2000
    baseHighPct: 1500, // было 3000
    limitReservePct: 500,
  }

  async function initializeAtZeroTick(pool: MockPool) {
    await pool.initialize(encodePriceSqrt(1, 1));
  }

  async function initializeAtTick(pool: MockPool, tick: number) {
    await pool.initialize(tick >= 0 ? encodePriceSqrt(Math.pow(1.0001, tick), 1) : encodePriceSqrt(1, Math.pow(1.0001, tick)));
  }

  // сделал отдельной фикстурой, потому что сначала пул должен проинициализироваться
  // потом уже должен деплоиться rebalanceManager, потому что он в конструкторе достает из пула tickSpacing
  async function deployAndSetRebalanceManager() {
      const rebalanceManagerFactory = await ethers.getContractFactory('MockRebalanceManager');
      rebalanceManager = (await rebalanceManagerFactory.deploy(
        await mockVault.getAddress(),
        7200,
        DEFAULT_THRESHOLDS,
      )) as any as MockRebalanceManager;

      await plugin.setRebalanceManager(rebalanceManager);
  }

  before('prepare signers', async () => {
    [wallet, other] = await (ethers as any).getSigners();
  });

  beforeEach('deploy test AlgebraBasePlugin', async () => {
    ({ mockVault, plugin, mockPluginFactory, mockPool, mockFactory } = await loadFixture(pluginFixtureALM));
  });

  describe('#Initialize', async () => {
    it('cannot initialize twice', async () => {
      await mockPool.setPlugin(await plugin.getAddress());
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
      await mockPool.setPlugin(await plugin.getAddress());
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
      await deployAndSetRebalanceManager();
      await plugin.initializeALM(rebalanceManager, 3600, 300);
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

  describe('#DynamicFeeManager', () => {
    describe('#adaptiveFee', function () {
      this.timeout(0);
      const liquidity = expandTo18Decimals(1000);
      const DAY = 60 * 60 * 24;
      let mint: any;

      beforeEach('initialize pool', async () => {
        await mockPool.setPlugin(plugin);
        await initializeAtZeroTick(mockPool);
        await deployAndSetRebalanceManager();
        await plugin.initializeALM(rebalanceManager, 3600, 300);
  
        mint = async (recipient: string, tickLower: number, tickUpper: number, liquidityDesired: number) => {
          await mockPool.mint(recipient, recipient, tickLower, tickUpper, liquidityDesired, '0x');
        };
      });

      it('does not change at 0 volume', async () => {
        await plugin.advanceTime(1);
        await mockPool.mint(wallet.address, wallet.address, -6000, 6000, liquidity, '0x');
        let fee2 = (await mockPool.overrideFee());
        await plugin.advanceTime(DAY + 600);
        await mint(wallet.address, -6000, 6000, 1);
        let fee3 = (await mockPool.overrideFee());
        expect(fee3).to.be.equal(fee2);
      });

      it('does not change fee after first swap in block', async () => {
        await mockPool.mint(wallet.address, wallet.address, -6000, 6000, liquidity, '0x');
        await plugin.advanceTime(DAY + 600);
        await mockPool.swapToTick(100);
        let feeInit = (await mockPool.overrideFee());
        await mockPool.swapToTick(100000);
        await mockPool.swapToTick(100001);
        let feeAfter = (await mockPool.overrideFee());
        expect(feeAfter).to.be.equal(feeInit);
      });

      it('does not change if alphas are zeroes', async () => {
        await plugin.changeFeeConfiguration({
          alpha1: 0,
          alpha2: 0,
          beta1: 360,
          beta2: 60000,
          gamma1: 59,
          gamma2: 8500,
          baseFee: 100,
        });
        await mockPool.mint(wallet.address, wallet.address, -6000, 6000, liquidity, '0x');
        await plugin.advanceTime(DAY + 600);
        await mockPool.swapToTick(100000);
        let feeInit = (await mockPool.overrideFee());
        await plugin.advanceTime(DAY + 600);
        await mockPool.swapToTick(-100000);
        let feeFinal = (await mockPool.overrideFee());
        expect(feeFinal).to.be.equal(feeInit);
      });

      it('single huge step after day', async () => {
        await mint(wallet.address, -24000, 24000, liquidity * 1000000000n);

        await plugin.advanceTime(DAY);
        await mockPool.swapToTick(10);
        await plugin.advanceTime(60);
        await mockPool.swapToTick(-10000);
        await plugin.advanceTime(60);
        await mockPool.swapToTick(10);

        let stats = [];
        const tick = 10;
        for (let i = 0; i < 25; i++) {
          await mockPool.swapToTick(tick - i);
          let fee = (await mockPool.overrideFee());
          stats.push(`Fee: ${fee} `);
          await plugin.advanceTime(60 * 60);
        }
        expect(stats).to.matchSnapshot('fee stats after step');
      });

      it('single huge step after initialization', async () => {
        await mint(wallet.address, -24000, 24000, liquidity * 1000000000n);

        await plugin.advanceTime(60);
        await mockPool.swapToTick(10);
        await plugin.advanceTime(60);
        await mockPool.swapToTick(-10000);
        await plugin.advanceTime(60);
        await mockPool.swapToTick(10);

        let stats = [];
        const tick = 10;
        for (let i = 0; i < 25; i++) {
          await mockPool.swapToTick(tick - i);
          let fee = (await mockPool.overrideFee());
          stats.push(`Fee: ${fee} `);
          await plugin.advanceTime(60 * 60);
        }
        expect(stats).to.matchSnapshot('fee stats after step');
      });

      it('single huge spike after day', async () => {
        await mint(wallet.address, -24000, 24000, liquidity * 1000000000n);
        await plugin.advanceTime(DAY);
        await plugin.advanceTime(60);
        await mockPool.swapToTick(-10000);
        await plugin.advanceTime(1);
        await mockPool.swapToTick(0);
        await plugin.advanceTime(60);
        await mockPool.swapToTick(10);

        let stats = [];
        const tick = 10;
        for (let i = 0; i < 25; i++) {
          await mockPool.swapToTick(tick - i);
          let fee = (await mockPool.overrideFee());
          stats.push(`Fee: ${fee} `);
          await plugin.advanceTime(60 * 60);
        }
        expect(stats).to.matchSnapshot('fee stats after spike');
      });

      it('single huge spike after initialization', async () => {
        await mint(wallet.address, -24000, 24000, liquidity * 1000000000n);

        await plugin.advanceTime(60);
        await mockPool.swapToTick(10);
        await plugin.advanceTime(60);
        await mockPool.swapToTick(-10000);
        await plugin.advanceTime(1);
        await mockPool.swapToTick(-11);
        await plugin.advanceTime(60);
        await mockPool.swapToTick(0);

        let stats = [];
        const tick = 0;
        for (let i = 0; i < 25; i++) {
          await mockPool.swapToTick(tick - i);
          let fee = (await mockPool.overrideFee());
          stats.push(`Fee: ${fee} `);
          await plugin.advanceTime(60 * 60);
        }
        expect(stats).to.matchSnapshot('fee stats after spike');
      });

      describe('#getCurrentFee', async () => {
        it('works with dynamic fee', async () => {
          await plugin.advanceTime(60);
          await mockPool.swapToTick(10);
          await plugin.advanceTime(60);
          await mockPool.swapToTick(10);
          const currentFee = await plugin.getCurrentFee();
          expect(currentFee).to.be.eq(100);
        });

        it('works if alphas are zeroes', async () => {
          await plugin.changeFeeConfiguration({
            alpha1: 0,
            alpha2: 0,
            beta1: 1001,
            beta2: 1006,
            gamma1: 20,
            gamma2: 22,
            baseFee: 100,
          });
          await plugin.advanceTime(60);
          await mockPool.swapToTick(10);
          await plugin.advanceTime(60);
          await mockPool.swapToTick(10);
          const currentFee = await plugin.getCurrentFee();
          expect(currentFee).to.be.eq(100);
        });

        it('works equal before and after timepoint write', async () => {
          await plugin.advanceTime(60);
          await mockPool.swapToTick(100);
          await plugin.advanceTime(60 * 10);
          await mockPool.swapToTick(1000);
          await plugin.advanceTime(60 * 10);
          const currentFee = await plugin.getCurrentFee();
          await mockPool.swapToTick(-1000);
          const currentFeeAfterSwap = await plugin.getCurrentFee();
          expect(currentFeeAfterSwap).to.be.eq(currentFee);
          await plugin.advanceTime(1);
          const currentFee2 = await plugin.getCurrentFee();
          expect(currentFeeAfterSwap).to.be.not.eq(currentFee2);
        });
      });
    });
  });

  describe('#AlmBasePlugin', () => {
    let initTick = 0;

    beforeEach('initialize pool', async () => {
      const defaultConfig = await plugin.defaultPluginConfig();
      await mockPool.setPlugin(plugin);
      await mockPool.setPluginConfig(BigInt(PLUGIN_FLAGS.AFTER_SWAP_FLAG) | defaultConfig);

      await initializeAtTick(mockPool, initTick);
      await deployAndSetRebalanceManager();
    });

    describe('validate thresholds', () => {
      it('should revert with invalid price change threshold', async () => {
        const t = { ...DEFAULT_THRESHOLDS, priceChangeThreshold: 10000 };
        await expect(rebalanceManager.validateThresholds(t)).to.be.revertedWith('Invalid price change threshold');
      });
    
      it('should revert with invalid base low percent', async () => {
        const t = { ...DEFAULT_THRESHOLDS, baseLowPct: 0 };
        await expect(rebalanceManager.validateThresholds(t)).to.be.revertedWith('Invalid base low percent');
      });
    
      it('should revert with invalid base high percent', async () => {
        const t = { ...DEFAULT_THRESHOLDS, baseHighPct: 0 };
        await expect(rebalanceManager.validateThresholds(t)).to.be.revertedWith('Invalid base high percent');
      });
    
      it('should revert with invalid limit reserve percent', async () => {
        const t = { ...DEFAULT_THRESHOLDS, limitReservePct: 0 };
        await expect(rebalanceManager.validateThresholds(t)).to.be.revertedWith('Invalid limit reserve percent');
      });
    
      it('should revert if _underInventoryThreshold <= 6000', async () => {
        const t = { ...DEFAULT_THRESHOLDS, underInventoryThreshold: 6000 };
        await expect(rebalanceManager.validateThresholds(t)).to.be.revertedWith('_underInventoryThreshold must be > 6000');
      });
    
      it('should revert if _normalThreshold <= _underInventoryThreshold', async () => {
        const t = { ...DEFAULT_THRESHOLDS, underInventoryThreshold: 7000, normalThreshold: 7000 };
        await expect(rebalanceManager.validateThresholds(t)).to.be.revertedWith('_normalThreshold must be > _underInventoryThreshold');
      });
    
      it('should revert if _overInventoryThreshold <= _normalThreshold', async () => {
        const t = { ...DEFAULT_THRESHOLDS, normalThreshold: 8000, overInventoryThreshold: 8000 };
        await expect(rebalanceManager.validateThresholds(t)).to.be.revertedWith('_overInventoryThreshold must be > _normalThreshold');
      });
    
      it('should revert if simulate <= _overInventoryThreshold', async () => {
        const t = { ...DEFAULT_THRESHOLDS, overInventoryThreshold: 8500, simulate: 8500 };
        await expect(rebalanceManager.validateThresholds(t)).to.be.revertedWith('Simulate must be > _overInventoryThreshold');
      });
    
      it('should revert if simulate >= stopThresholdBps', async () => {
        const t = { ...DEFAULT_THRESHOLDS, stopThresholdBps: 9500, simulate: 9500 };
        await expect(rebalanceManager.validateThresholds(t)).to.be.revertedWith('Simulate must be < 9500');
      });
    
      it('should revert if _dtrDelta > 10000', async () => {
        const t = { ...DEFAULT_THRESHOLDS, dtrDelta: 10001 };
        await expect(rebalanceManager.validateThresholds(t)).to.be.revertedWith('_dtrDelta must be <= 10000');
      });
    
      it('should revert if highVolatility < someVolatility', async () => {
        const t = { ...DEFAULT_THRESHOLDS, someVolatility: 300, highVolatility: 299 };
        await expect(rebalanceManager.validateThresholds(t)).to.be.revertedWith('_highVolatility must be >= someVolatility');
      });
    
      it('should revert if extremeVolatility < highVolatility', async () => {
        const t = { ...DEFAULT_THRESHOLDS, highVolatility: 400, extremeVolatility: 399 };
        await expect(rebalanceManager.validateThresholds(t)).to.be.revertedWith('_extremeVolatility must be >= highVolatility');
      });
    
      it('should revert if depositTokenUnusedThreshold < 100', async () => {
        const t = { ...DEFAULT_THRESHOLDS, depositTokenUnusedThreshold: 99 };
        await expect(rebalanceManager.validateThresholds(t)).to.be.revertedWith('_depositTokenUnusedThreshold must be 100 <= _depositTokenUnusedThreshold <= 10000');
      });
    
      it('should revert if depositTokenUnusedThreshold > 10000', async () => {
        const t = { ...DEFAULT_THRESHOLDS, depositTokenUnusedThreshold: 10001 };
        await expect(rebalanceManager.validateThresholds(t)).to.be.revertedWith('_depositTokenUnusedThreshold must be 100 <= _depositTokenUnusedThreshold <= 10000');
      });

      it('should revert if someVolatility > 300', async () => {
        const t = { ...DEFAULT_THRESHOLDS, someVolatility: 301 };
        await expect(rebalanceManager.validateThresholds(t)).to.be.revertedWith('_someVolatility must be <= 300');
      });
    
      it('should pass with valid thresholds', async () => {
        await rebalanceManager.validateThresholds(DEFAULT_THRESHOLDS);
      });
    });    

    describe('setters', () => {
      before('prepare signers', async () => {
        [wallet, other] = await (ethers as any).getSigners();
      });

      beforeEach('grant role', async () => {
        await mockFactory.grantRole(await rebalanceManager.ALGEBRA_BASE_PLUGIN_MANAGER(), wallet);
        expect(await mockFactory.hasRoleOrOwner(await rebalanceManager.ALGEBRA_BASE_PLUGIN_MANAGER(), wallet)).to.be.equals(true);
      });

      it('should revert for unauthorized address', async () => {
        const newVault = '0x1234567890123456789012345678901234567890';
        await expect(rebalanceManager.connect(other).setVault(newVault)).to.be.reverted;
      });

      it('setPriceChangeThreshold', async () => {
        await expect(rebalanceManager.setPriceChangeThreshold(10000)).to.be.revertedWith('Invalid price change threshold');
        await rebalanceManager.setPriceChangeThreshold(50);
        expect((await rebalanceManager.thresholds())[5]).to.be.equals(50);
      });

      it('setPercentages', async () => {
        await expect(rebalanceManager.setPercentages(0, 0, 0)).to.be.revertedWith('Invalid base low percent');
        await expect(rebalanceManager.setPercentages(100, 0, 0)).to.be.revertedWith('Invalid base high percent');
        await expect(rebalanceManager.setPercentages(100, 100, 0)).to.be.revertedWith('Invalid limit reserve percent');
        await rebalanceManager.setPercentages(100, 200, 300);
        expect((await rebalanceManager.thresholds())[10]).to.be.equals(100);
        expect((await rebalanceManager.thresholds())[11]).to.be.equals(200);
        expect((await rebalanceManager.thresholds())[12]).to.be.equals(300);
      });

      it('setTriggers', async () => {
        await expect(
          rebalanceManager.setTriggers(7000, 7001, 6000, 7002)
        ).to.be.revertedWith('_underInventoryThreshold must be > 6000');
        await expect(
          rebalanceManager.setTriggers(8000, 7000, 7000, 8001)
        ).to.be.revertedWith('_normalThreshold must be > _underInventoryThreshold');
        await expect(
          rebalanceManager.setTriggers(8500, 8000, 7000, 8000)
        ).to.be.revertedWith('_overInventoryThreshold must be > _normalThreshold');      
        await expect(
          rebalanceManager.setTriggers(8000, 7500, 7000, 8001)
        ).to.be.revertedWith('Simulate must be > _overInventoryThreshold');
        await expect(
          rebalanceManager.setTriggers(9500, 8100, 8000, 8200)
        ).to.be.revertedWith('Simulate must be < 9500');
      
        await rebalanceManager.setTriggers(9000, 8100, 8000, 8200);
        const thresholds = await rebalanceManager.thresholds();
        expect(thresholds[1]).to.be.equal(9000);
        expect(thresholds[2]).to.be.equal(8100);
        expect(thresholds[3]).to.be.equal(8000);
        expect(thresholds[4]).to.be.equal(8200);
      });

      it('setDtrDelta', async () => {
        await expect(
          rebalanceManager.setDtrDelta(10001)
        ).to.be.revertedWith('_dtrDelta must be <= 10000');
      
        await rebalanceManager.setDtrDelta(5000);
        const thresholds = await rebalanceManager.thresholds();
        expect(thresholds[9]).to.be.equal(5000); // dtrDelta
      });

      it('setHighVolatility', async () => {
        await expect(
          rebalanceManager.setHighVolatility(199)
        ).to.be.revertedWith('_highVolatility must be >= someVolatility');
      
        await rebalanceManager.setHighVolatility(300);
        const thresholds = await rebalanceManager.thresholds();
        expect(thresholds[7]).to.be.equal(300);
      });
      
      it('setSomeVolatility', async () => {
        await expect(
          rebalanceManager.setSomeVolatility(301)
        ).to.be.revertedWith('_someVolatility must be <= 300');
      
        await rebalanceManager.setSomeVolatility(200);
        const thresholds = await rebalanceManager.thresholds();
        expect(thresholds[8]).to.be.equal(200); // someVolatility
      });

      it('setHighVolatility', async () => {
        // Сначала устанавливаем someVolatility
        await rebalanceManager.setSomeVolatility(250);
      
        // Проверка: _highVolatility < someVolatility
        await expect(
          rebalanceManager.setHighVolatility(200)
        ).to.be.revertedWith('_highVolatility must be >= someVolatility');
      
        // Успешный вызов
        await rebalanceManager.setHighVolatility(300);
        const thresholds = await rebalanceManager.thresholds();
        expect(thresholds[7]).to.be.equal(300); // highVolatility
      });

      it('setExtremeVolatility', async () => {
        // Сначала устанавливаем highVolatility
        await rebalanceManager.setHighVolatility(400);
      
        // Проверка: _extremeVolatility < highVolatility
        await expect(
          rebalanceManager.setExtremeVolatility(399)
        ).to.be.revertedWith('_extremeVolatility must be >= highVolatility');
      
        // Успешный вызов
        await rebalanceManager.setExtremeVolatility(500);
        const thresholds = await rebalanceManager.thresholds();
        expect(thresholds[6]).to.be.equal(500); // extremeVolatility
      });

      it('setDepositTokenUnusedThreshold', async () => {
        await expect(
          rebalanceManager.setDepositTokenUnusedThreshold(99)
        ).to.be.revertedWith('_depositTokenUnusedThreshold must be 100 <= _depositTokenUnusedThreshold <= 10000');
      
        await expect(
          rebalanceManager.setDepositTokenUnusedThreshold(10001)
        ).to.be.revertedWith('_depositTokenUnusedThreshold must be 100 <= _depositTokenUnusedThreshold <= 10000');
      
        await rebalanceManager.setDepositTokenUnusedThreshold(300);
        const thresholds = await rebalanceManager.thresholds();
        expect(thresholds[0]).to.be.equal(300);
      });

      it('setMinTimeBetweenRebalances', async () => {
        await rebalanceManager.setMinTimeBetweenRebalances(3600);
        const value = await rebalanceManager.minTimeBetweenRebalances();
        expect(value).to.be.equal(3600);
      });

      it('setVault', async () => {
        const newVault = '0x1234567890123456789012345678901234567890';
        await rebalanceManager.setVault(newVault);
        const vault = await rebalanceManager.vault();
        expect(vault).to.equal(newVault);
      });
    });

    async function setTotalAmounts(amount0: bigint, amount1: bigint, allowToken1: boolean) {
      if (allowToken1) {
        await mockVault.setTotalAmounts(amount1, amount0);
      } else {
        await mockVault.setTotalAmounts(amount0, amount1);
      }
    }

    async function checkState(expectedState: State) {
      expect((await rebalanceManager.state())).to.be.eq(expectedState);
    }

    const allowTokenCombos = [
      // { allowToken1: false },
      { allowToken1: true },
    ];

    const defaultSwapToTickCombos = [
      {defaultSwapToTick: 0},
      // {defaultSwapToTick: 1}
    ]

    defaultSwapToTickCombos.forEach(({ defaultSwapToTick }) => {
      allowTokenCombos.forEach(({allowToken1 }) => {
        describe(`rebalances (allowToken1=${allowToken1})`, () => {
          beforeEach(async () => {
            await rebalanceManager.setAllowToken1(allowToken1);
          });

          it('rebalance could call only plugin', async () => {
            await expect(rebalanceManager.obtainTWAPAndRebalance(0n, 0n, 0n, 0n)).to.be.revertedWith('Should only called by plugin');
          });

          it('first rebalance over -> over, pairedToken >= depositToken', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(10000n, 0n, allowToken1);
            await plugin.advanceTime(5000);
            await expect(mockPool.swapToTick(defaultSwapToTick)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Normal, State.OverInventory);
            await checkState(State.OverInventory);
          });

          it('first rebalance with low percentageOfDepositToken', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(10000n, 0n, allowToken1);
            await plugin.advanceTime(5000);
            await expect(mockPool.swapToTick(defaultSwapToTick)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Normal, State.OverInventory);
            await checkState(State.OverInventory);

            await setTotalAmounts(1000n, 9000n, allowToken1);
            await plugin.advanceTime(5000);
            await expect(mockPool.swapToTick(defaultSwapToTick)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Special, State.Special);
          });

          it('first rebalance over -> over, pairedToken < depositToken', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await rebalanceManager.setTokens('0x0000000000000000000000000000000000000001', '0x0000000000000000000000000000000000000000');
            await setTotalAmounts(10000n, 0n, allowToken1);
            await plugin.advanceTime(5000);
            await expect(mockPool.swapToTick(defaultSwapToTick)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Normal, State.OverInventory);
            await checkState(State.OverInventory);
          });

          it('over state no rebalance - some volatility', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(10000n, 0n, allowToken1);
            await plugin.advanceTime(5000);
            await expect(mockPool.swapToTick(300)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.TooSoon, State.OverInventory);
            await checkState(State.OverInventory);
          });

          it('over state no rebalance - some volatility, pairedToken < depositToken', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await rebalanceManager.setTokens('0x0000000000000000000000000000000000000001', '0x0000000000000000000000000000000000000000');
            await setTotalAmounts(10000n, 0n, allowToken1);
            await plugin.advanceTime(5000);
            await expect(mockPool.swapToTick(300)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.TooSoon, State.OverInventory);
            await checkState(State.OverInventory);
          });

          it('under -> under', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(0n);
            await rebalanceManager.setState(State.UnderInventory);
            await setTotalAmounts(0n, 10000n, allowToken1);
            await plugin.advanceTime(5000);
            await expect(mockPool.swapToTick(defaultSwapToTick)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Normal, State.UnderInventory);
            await checkState(State.UnderInventory);
          });

          it('under state no rebalance - some volatility', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(0n);
            await rebalanceManager.setState(State.UnderInventory);
            await setTotalAmounts(0n, 10000n, allowToken1);
            await plugin.advanceTime(5000);
            await expect(mockPool.swapToTick(300)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.TooSoon, State.UnderInventory);
            await checkState(State.UnderInventory);
          });

          it('over -> normal', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(8000n, 2000n, allowToken1);
            await plugin.advanceTime(3600);
            await expect(mockPool.swapToTick(defaultSwapToTick)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Normal, State.Normal);
            await checkState(State.Normal);
          });

          it('over -> normal -> over', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(8000n, 2000n, allowToken1);
            await plugin.advanceTime(3600);
            await expect(mockPool.swapToTick(defaultSwapToTick)).to.emit(rebalanceManager, 'MockUpdateStatus').withArgs(true, State.Normal);
            await checkState(State.Normal);
            await setTotalAmounts(10000n, 0n, allowToken1);
            await rebalanceManager.advanceTime(7200);
            await expect(mockPool.swapToTick(defaultSwapToTick)).to.emit(rebalanceManager, 'MockUpdateStatus').withArgs(true, State.OverInventory);
            await checkState(State.OverInventory);
          });

          it('over -> special, high volatility', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(8000n, 2000n, allowToken1);
            await plugin.advanceTime(3600);
            await expect(mockPool.swapToTick(2000)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Special, State.Special);
            await expect(mockPool.swapToTick(defaultSwapToTick)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.TooSoon, State.Special);
          });

          it('over -> special, high volatility, rounded tick', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(8000n, 2000n, allowToken1);
            await plugin.advanceTime(3600);
            await expect(mockPool.swapToTick(2040)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Special, State.Special);
            await expect(mockPool.swapToTick(defaultSwapToTick)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.TooSoon, State.Special);
          });

          it('no rebalance - extreme volatility', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(8000n, 2000n, allowToken1);
            await plugin.advanceTime(3600);
            await expect(mockPool.swapToTick(3000)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.ExtremeVolatility, State.Special);
            await checkState(State.Special);
          });

          it('no rebalance - too soon', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(8000n, 2000n, allowToken1);
            await plugin.advanceTime(3600);
            await mockPool.swapToTick(100);
            await checkState(State.Normal);
            await plugin.advanceTime(1800);
            await expect(mockPool.swapToTick(1000)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.TooSoon, State.Special);
            await checkState(State.Normal);
          });

          it('no rebalance - volatility too low', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(8000n, 2000n, allowToken1);
            await plugin.advanceTime(3600);
            await expect(mockPool.swapToTick(250)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.TooSoon, State.Normal);
            await checkState(State.OverInventory);
          });

          it('no rebalance - percentageOfDepositTokenUnused too low', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            // await rebalanceManager.setDepositTokenBalance(0n);
            await setTotalAmounts(9200n, 800n, allowToken1);
            await plugin.advanceTime(3600);
            await mockPool.swapToTick(defaultSwapToTick);
            await checkState(State.Normal);

            await plugin.advanceTime(7200);
            await rebalanceManager.advanceTime(7200);

            // await rebalanceManager.setState(1); // normal state
            await expect(mockPool.swapToTick(defaultSwapToTick)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.NoNeedWithPending, State.Normal);
            await checkState(State.Normal);
          });

          it('no rebalance - high volatility in the same block', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(8000n, 2000n, allowToken1);
            await plugin.advanceTime(3600);
            await rebalanceManager.advanceTime(3600);
            await network.provider.send("evm_setAutomine", [false]);
            // https://github.com/NomicFoundation/hardhat/issues/4090
            await mockPool.swapToTick(1, { gasLimit: 2000000 });
            const tx = await mockPool.swapToTick(2000, { gasLimit: 2000000 });
            await network.provider.send("evm_mine");
            await expect(tx).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.TooSoon, State.Special);
            await checkState(State.Normal);
            await network.provider.send("evm_setAutomine", [true]);
          });

          it('rebalance not triggered for low volatility', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(8000n, 2000n, allowToken1);
            await plugin.advanceTime(3600);
            await expect(mockPool.swapToTick(300)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.TooSoon, State.Normal);
            await checkState(State.OverInventory);
          });

          it('rebalance triggered for high volatility after time threshold', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(8000n, 2000n, allowToken1);
            await plugin.advanceTime(3600);
            await mockPool.swapToTick(2000);
            await checkState(State.Special);
            await plugin.advanceTime(3600);
            await expect(mockPool.swapToTick(defaultSwapToTick))
              .to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.NoNeed, State.Special);
            await checkState(State.Special);
          });

          it('over -> over -> normal', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(10000n, 0n, allowToken1);
            await plugin.advanceTime(5000);
            await expect(mockPool.swapToTick(defaultSwapToTick)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Normal, State.OverInventory);
            await checkState(State.OverInventory);

            await setTotalAmounts(8100n, 1900n, allowToken1);
            await rebalanceManager.advanceTime(7200);
            await plugin.advanceTime(7200);
            await expect(mockPool.swapToTick(defaultSwapToTick))
              .to.emit(rebalanceManager, 'MockUpdateStatus').withArgs(true, State.Normal)
              .to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Normal, State.Normal);
            await checkState(State.Normal);
          });

          it('over -> normal -> normal', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(8100n, 1900n, allowToken1);
            await plugin.advanceTime(5000);
            await expect(mockPool.swapToTick(defaultSwapToTick)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Normal, State.Normal);
            await checkState(State.Normal);

            await rebalanceManager.advanceTime(7200);
            await plugin.advanceTime(7200);
            await expect(mockPool.swapToTick(defaultSwapToTick))
              .to.emit(rebalanceManager, 'MockUpdateStatus').withArgs(true, State.Normal)
              .to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Normal, State.Normal);
            await checkState(State.Normal);
          });

          it('over -> under -> over', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(7500n, 2500n, allowToken1);
            await plugin.advanceTime(5000);
            await expect(mockPool.swapToTick(defaultSwapToTick)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Normal, State.UnderInventory);
            await checkState(State.UnderInventory);

            await setTotalAmounts(9500n, 500n, allowToken1);
            await rebalanceManager.advanceTime(7200);
            await plugin.advanceTime(7200);
            await expect(mockPool.swapToTick(defaultSwapToTick))
              .to.emit(rebalanceManager, 'MockUpdateStatus').withArgs(true, State.OverInventory)
              .to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Normal, State.OverInventory);
            await checkState(State.OverInventory);
          });

          it('over -> under -> normal', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(7500n, 2500n, allowToken1);
            await plugin.advanceTime(5000);
            await expect(mockPool.swapToTick(defaultSwapToTick)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Normal, State.UnderInventory);
            await checkState(State.UnderInventory);

            await setTotalAmounts(8100n, 1900n, allowToken1);
            await rebalanceManager.advanceTime(7200);
            await plugin.advanceTime(7200);
            await expect(mockPool.swapToTick(defaultSwapToTick))
              .to.emit(rebalanceManager, 'MockUpdateStatus').withArgs(true, State.Normal)
              .to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Normal, State.Normal);
            await checkState(State.Normal);
          });

          it('over -> under -> under', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(7500n, 2500n, allowToken1);
            await plugin.advanceTime(5000);
            await expect(mockPool.swapToTick(defaultSwapToTick)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Normal, State.UnderInventory);
            await checkState(State.UnderInventory);

            await setTotalAmounts(8000n, 2000n, allowToken1);
            await rebalanceManager.advanceTime(7200);
            await plugin.advanceTime(7200);
            await expect(mockPool.swapToTick(defaultSwapToTick))
              .to.emit(rebalanceManager, 'MockUpdateStatus').withArgs(true, State.UnderInventory)
              .to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Normal, State.UnderInventory);
            await checkState(State.UnderInventory);
          });

          it('over -> under -> special', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(7500n, 2500n, allowToken1);
            await plugin.advanceTime(5000);
            await expect(mockPool.swapToTick(defaultSwapToTick)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Normal, State.UnderInventory);
            await checkState(State.UnderInventory);

            await setTotalAmounts(8000n, 2000n, allowToken1);
            await rebalanceManager.advanceTime(7200);
            await plugin.advanceTime(7200);
            await expect(mockPool.swapToTick(2000)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Special, State.Special);
            await checkState(State.Special);
          });

          it('over -> over -> under', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(10000n, 0n, allowToken1);
            await plugin.advanceTime(5000);
            await expect(mockPool.swapToTick(defaultSwapToTick)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Normal, State.OverInventory);
            await checkState(State.OverInventory);

            await setTotalAmounts(7500n, 2500n, allowToken1);
            await rebalanceManager.advanceTime(7200);
            await plugin.advanceTime(7200);
            await expect(mockPool.swapToTick(defaultSwapToTick))
              .to.emit(rebalanceManager, 'MockUpdateStatus').withArgs(true, State.UnderInventory)
              .to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Normal, State.UnderInventory);
            await checkState(State.UnderInventory);
          });

          it('over -> over -> current, priceChange < priceChangeThreshold', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(10000n, 0n, allowToken1);
            await plugin.advanceTime(5000);
            await expect(mockPool.swapToTick(defaultSwapToTick)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Normal, State.OverInventory);
            await checkState(State.OverInventory);

            await setTotalAmounts(9200n, 800n, allowToken1);
            await rebalanceManager.advanceTime(7200);
            await plugin.advanceTime(7200);
            await expect(mockPool.swapToTick(100))
              .to.emit(rebalanceManager, 'MockUpdateStatus').withArgs(true, State.OverInventory)
              .to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Normal, State.OverInventory);
            await checkState(State.OverInventory);
          });

          it('over -> normal -> under', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(8000n, 2000n, allowToken1);
            await plugin.advanceTime(5000);
            await expect(mockPool.swapToTick(defaultSwapToTick)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Normal, State.Normal);
            await checkState(State.Normal);

            await setTotalAmounts(7700n, 2300n, allowToken1);
            await rebalanceManager.advanceTime(7200);
            await plugin.advanceTime(7200);
            await expect(mockPool.swapToTick(defaultSwapToTick))
              .to.emit(rebalanceManager, 'MockUpdateStatus').withArgs(true, State.UnderInventory)
              .to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Normal, State.UnderInventory);
            await checkState(State.UnderInventory);
          });

          it('over -> normal -> special', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(8000n, 2000n, allowToken1);
            await plugin.advanceTime(5000);
            await expect(mockPool.swapToTick(defaultSwapToTick)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Normal, State.Normal);
            await checkState(State.Normal);

            await setTotalAmounts(7700n, 2300n, allowToken1);
            await rebalanceManager.advanceTime(7200);
            await plugin.advanceTime(7200);
            await expect(mockPool.swapToTick(2000)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Special, State.Special);
            await checkState(State.Special);
          });

          it('over -> special -> over', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(10000n, 0n, allowToken1);
            await plugin.advanceTime(5000);
            await expect(mockPool.swapToTick(2000)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Special, State.Special);
            await checkState(State.Special);

            // await setTotalAmounts(10000n, 0n, allowToken1);
            await rebalanceManager.advanceTime(7200);
            await plugin.advanceTime(7200);
            await expect(mockPool.swapToTick(2000)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Normal, State.OverInventory);
            await checkState(State.OverInventory);
          });

          it('over -> special -> normal', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(10000n, 0n, allowToken1);
            await plugin.advanceTime(5000);
            await expect(mockPool.swapToTick(2000)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Special, State.Special);
            await checkState(State.Special);

            await setTotalAmounts(8000n, 2000n, allowToken1);
            await rebalanceManager.advanceTime(7200);
            await plugin.advanceTime(7200);
            await expect(mockPool.swapToTick(2000)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Normal, State.Normal);
            await checkState(State.Normal);
          });

          it.only('over -> special -> under', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(10000n, 0n, allowToken1);
            await plugin.advanceTime(5000);
            await expect(mockPool.swapToTick(2000)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Special, State.Special);
            await checkState(State.Special);

            await setTotalAmounts(7000n, 3000n, allowToken1);
            await rebalanceManager.advanceTime(7200);
            await plugin.advanceTime(7200);
            await expect(mockPool.swapToTick(2000)).to.emit(rebalanceManager, 'MockDecideRebalance').withArgs(DecideStatus.Normal, State.UnderInventory);
            await checkState(State.UnderInventory);
          });

          it('no rebalance - no vault, should pause', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await mockVault.setShouldRevertOnRebalance(true);
            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(8000n, 2000n, allowToken1);
            await plugin.advanceTime(5000);
            await mockPool.swapToTick(defaultSwapToTick);
            expect(await rebalanceManager.paused()).to.be.eq(true);
            await checkState(State.Special);

            await expect(mockPool.swapToTick(defaultSwapToTick)).not.to.emit(rebalanceManager, 'MockDecideRebalance');
            
            await rebalanceManager.unpause();
            await expect(rebalanceManager.unpause()).to.be.revertedWith('Already unpaused');
            expect(await rebalanceManager.paused()).to.be.eq(false);
          });

          it('no rebalance without rebalance manager', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await plugin.setRebalanceManager(ZERO_ADDRESS);
            await plugin.advanceTime(5000);
            await expect(mockPool.swapToTick(defaultSwapToTick)).not.to.emit(rebalanceManager, 'MockDecideRebalance');
          });

          it('no rebalance without vault', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setVault(ZERO_ADDRESS);
            
            await plugin.advanceTime(5000);
            await expect(mockPool.swapToTick(defaultSwapToTick, {gasLimit: 1_000_000})).not.to.emit(rebalanceManager, 'MockDecideRebalance');
          });

          it('should revert with insufficient gas limit', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(10000n, 0n, allowToken1);
            await plugin.advanceTime(5000);
            await expect(mockPool.swapToTick(0, {gasLimit: 1_000_000})).to.revertedWith('Not enough gas left');
          });

          it('should not rebalance with narrow positions', async () => {
            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setPercentages(100n, 100n, 100n);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(10000n, 0n, allowToken1);
            await plugin.advanceTime(5000);
            await mockPool.swapToTick(0);
            expect(await rebalanceManager.lastRebalanceTimestamp()).to.be.equals(0n);
          });

          it('no rebalance on extreme ticks', async () => {
            initTick = 500_000;

            await rebalanceManager.setDecimals(18, 18);
            await plugin.initializeALM(rebalanceManager, 3600, 300);

            await rebalanceManager.setDepositTokenBalance(10000n);
            await setTotalAmounts(10000n, 0n, allowToken1);
            await plugin.advanceTime(5000);
            await expect(mockPool.swapToTick(500_000)).not.to.emit(rebalanceManager, 'MockDecideRebalance');
            await checkState(State.OverInventory);

            initTick = 0;
          });
        });
      });
    });
  });

  // describe('#FarmingPlugin', () => {
  //   describe('virtual pool tests', () => {
  //     let virtualPoolMock: MockTimeVirtualPool;

  //     beforeEach('deploy virtualPoolMock', async () => {
  //       await mockPluginFactory.setFarmingAddress(wallet);
  //       const virtualPoolMockFactory = await ethers.getContractFactory('MockTimeVirtualPool');
  //       virtualPoolMock = (await virtualPoolMockFactory.deploy()) as any as MockTimeVirtualPool;
  //     });

  //     it('set incentive works', async () => {
  //       await mockPool.setPlugin(plugin);
  //       await plugin.setIncentive(virtualPoolMock);
  //       expect(await plugin.incentive()).to.be.eq(await virtualPoolMock.getAddress());
  //     });

  //     it('can detach incentive', async () => {
  //       await mockPool.setPlugin(plugin);
  //       await plugin.setIncentive(virtualPoolMock);
  //       await plugin.setIncentive(ZeroAddress);
  //       expect(await plugin.incentive()).to.be.eq(ZeroAddress);
  //     });

  //     it('can detach incentive even if no more has rights to connect plugins', async () => {
  //       await mockPool.setPlugin(plugin);
  //       await plugin.setIncentive(virtualPoolMock);
  //       await mockPluginFactory.setFarmingAddress(other);
  //       await plugin.setIncentive(ZeroAddress);
  //       expect(await plugin.incentive()).to.be.eq(ZeroAddress);
  //     });

  //     it('cannot attach incentive even if no more has rights to connect plugins', async () => {
  //       await mockPool.setPlugin(plugin);
  //       await plugin.setIncentive(virtualPoolMock);
  //       await mockPluginFactory.setFarmingAddress(other);
  //       await expect(plugin.setIncentive(other)).to.be.revertedWith('Not allowed to set incentive');
  //     });

  //     it('new farming can detach old incentive', async () => {
  //       await mockPool.setPlugin(plugin);
  //       await plugin.setIncentive(virtualPoolMock);
  //       await mockPluginFactory.setFarmingAddress(other);
  //       await plugin.connect(other).setIncentive(ZeroAddress);
  //       expect(await plugin.incentive()).to.be.eq(ZeroAddress);
  //     });

  //     it('cannot detach incentive if nothing connected', async () => {
  //       await mockPool.setPlugin(plugin);
  //       await expect(plugin.setIncentive(ZeroAddress)).to.be.revertedWith('Already active');
  //       expect(await plugin.incentive()).to.be.eq(ZeroAddress);
  //     });

  //     it('cannot set same incentive twice', async () => {
  //       await mockPool.setPlugin(plugin);
  //       await plugin.setIncentive(virtualPoolMock);
  //       await expect(plugin.setIncentive(virtualPoolMock)).to.be.revertedWith('Already active');
  //     });

  //     it('cannot set incentive if has active', async () => {
  //       await mockPool.setPlugin(plugin);
  //       await plugin.setIncentive(virtualPoolMock);
  //       await expect(plugin.setIncentive(wallet.address)).to.be.revertedWith('Has active incentive');
  //     });

  //     it('can detach incentive if not connected to pool', async () => {
  //       const defaultConfig = await plugin.defaultPluginConfig();
  //       await mockPool.setPlugin(plugin);
  //       await mockPool.setPluginConfig(BigInt(PLUGIN_FLAGS.AFTER_SWAP_FLAG) | defaultConfig);
  //       await plugin.setIncentive(virtualPoolMock);
  //       expect(await plugin.incentive()).to.be.eq(await virtualPoolMock.getAddress());
  //       await mockPool.setPlugin(ZeroAddress);
  //       await plugin.setIncentive(ZeroAddress);
  //       expect(await plugin.incentive()).to.be.eq(ZeroAddress);
  //     });

  //     it('can set incentive if afterSwap hook is active', async () => {
  //       const defaultConfig = await plugin.defaultPluginConfig();
  //       await mockPool.setPlugin(plugin);
  //       await mockPool.setPluginConfig(BigInt(PLUGIN_FLAGS.AFTER_SWAP_FLAG) | defaultConfig);
  //       await plugin.setIncentive(virtualPoolMock);
  //       expect(await plugin.incentive()).to.be.eq(await virtualPoolMock.getAddress());
  //       expect((await mockPool.globalState()).pluginConfig).to.be.eq(BigInt(PLUGIN_FLAGS.AFTER_SWAP_FLAG) | defaultConfig);
  //     });

  //     it('set incentive works only for PluginFactory.farmingAddress', async () => {
  //       await mockPluginFactory.setFarmingAddress(ZeroAddress);
  //       await expect(plugin.setIncentive(virtualPoolMock)).to.be.revertedWith('Not allowed to set incentive');
  //     });

  //     it('incentive can not be attached if plugin is not attached', async () => {
  //       await expect(plugin.setIncentive(virtualPoolMock)).to.be.revertedWith('Plugin not attached');
  //     });

  //     it('incentive attached before initialization', async () => {
  //       await mockPool.setPlugin(plugin);

  //       await plugin.setIncentive(virtualPoolMock);
  //       await mockPool.initialize(encodePriceSqrt(1, 1));
  //       await mockPool.mint(wallet.address, wallet.address, -120, 120, 1, '0x');
  //       await mockPool.mint(wallet.address, wallet.address, minTick, maxTick, 1, '0x');

  //       await mockPool.swapToTick(-130);

  //       expect(await plugin.incentive()).to.be.eq(await virtualPoolMock.getAddress());
  //       expect(await plugin.isIncentiveConnected(virtualPoolMock)).to.be.true;

  //       const tick = (await mockPool.globalState()).tick;
  //       expect(await virtualPoolMock.currentTick()).to.be.eq(tick);
  //       expect(await virtualPoolMock.timestamp()).to.be.gt(0);
  //     });

  //     it('incentive attached after initialization', async () => {
  //       await mockPool.setPlugin(plugin);
  //       await mockPool.initialize(encodePriceSqrt(1, 1));
  //       await plugin.setIncentive(virtualPoolMock);

  //       await mockPool.mint(wallet.address, wallet.address, -120, 120, 1, '0x');
  //       await mockPool.mint(wallet.address, wallet.address, minTick, maxTick, 1, '0x');

  //       await mockPool.swapToTick(-130);

  //       expect(await plugin.incentive()).to.be.eq(await virtualPoolMock.getAddress());
  //       expect(await plugin.isIncentiveConnected(virtualPoolMock)).to.be.true;

  //       const tick = (await mockPool.globalState()).tick;
  //       expect(await virtualPoolMock.currentTick()).to.be.eq(tick);
  //       expect(await virtualPoolMock.timestamp()).to.be.gt(0);
  //     });

  //     it.skip('swap with finished incentive', async () => {
  //       /*await virtualPoolMock.setIsExist(false);
  //        await mockPool.setIncentive(virtualPoolMock.address);
  //        await mockPool.initialize(encodePriceSqrt(1, 1));
  //        await mint(wallet.address, -120, 120, 1);
  //        await mint(wallet.address, minTick, maxTick, 1);
  //        expect(await mockPool.activeIncentive()).to.be.eq(virtualPoolMock.address);    
   
  //        await swapToLowerPrice(encodePriceSqrt(1, 2), wallet.address);
   
  //        expect(await mockPool.activeIncentive()).to.be.eq(ethers.constants.AddressZero);
  //        expect(await virtualPoolMock.currentTick()).to.be.eq(0);
  //        expect(await virtualPoolMock.timestamp()).to.be.eq(0);
  //        */
  //     });

  //     it.skip('swap with not started yet incentive', async () => {
  //       /*
  //        await virtualPoolMock.setIsStarted(false);
  //        await mockPool.setIncentive(virtualPoolMock.address);
  //        await mockPool.initialize(encodePriceSqrt(1, 1));
  //        await mint(wallet.address, -120, 120, 1);
  //        await mint(wallet.address, minTick, maxTick, 1);
  //        expect(await mockPool.activeIncentive()).to.be.eq(virtualPoolMock.address);    
   
  //        await swapToLowerPrice(encodePriceSqrt(1, 2), wallet.address);
   
  //        const tick = (await mockPool.globalState()).tick;
  //        expect(await mockPool.activeIncentive()).to.be.eq(virtualPoolMock.address);
  //        expect(await virtualPoolMock.currentTick()).to.be.eq(tick);
  //        expect(await virtualPoolMock.timestamp()).to.be.eq(0); 
  //        */
  //     });
  //   });

  //   describe('#isIncentiveConnected', () => {
  //     let virtualPoolMock: MockTimeVirtualPool;

  //     beforeEach('deploy virtualPoolMock', async () => {
  //       await mockPluginFactory.setFarmingAddress(wallet);
  //       const virtualPoolMockFactory = await ethers.getContractFactory('MockTimeVirtualPool');
  //       virtualPoolMock = (await virtualPoolMockFactory.deploy()) as any as MockTimeVirtualPool;
  //     });

  //     it('true with active incentive', async () => {
  //       await mockPool.setPlugin(plugin);
  //       await plugin.setIncentive(virtualPoolMock);
  //       expect(await plugin.isIncentiveConnected(virtualPoolMock)).to.be.true;
  //     });

  //     it('false with invalid address', async () => {
  //       await mockPool.setPlugin(plugin);
  //       await plugin.setIncentive(virtualPoolMock);
  //       expect(await plugin.isIncentiveConnected(wallet.address)).to.be.false;
  //     });

  //     it('false if plugin detached', async () => {
  //       await mockPool.setPlugin(plugin);
  //       await plugin.setIncentive(virtualPoolMock);
  //       await mockPool.setPlugin(ZeroAddress);
  //       expect(await plugin.isIncentiveConnected(virtualPoolMock)).to.be.false;
  //     });

  //     it('false if hook deactivated', async () => {
  //       await mockPool.setPlugin(plugin);
  //       await plugin.setIncentive(virtualPoolMock);
  //       await mockPool.setPluginConfig(0);
  //       expect(await plugin.isIncentiveConnected(virtualPoolMock)).to.be.false;
  //     });
  //   });

  //   describe('#Incentive', () => {
  //     it('incentive is not detached after swap', async () => {
  //       await mockPool.setPlugin(plugin);
  //       await initializeAtZeroTick(mockPool);
  //       await mockPluginFactory.setFarmingAddress(wallet.address);

  //       const vpStubFactory = await ethers.getContractFactory('MockTimeVirtualPool');
  //       let vpStub = (await vpStubFactory.deploy()) as any as MockTimeVirtualPool;

  //       await plugin.setIncentive(vpStub);
  //       const initLiquidityAmount = 10000000000n;
  //       await mockPool.mint(wallet.address, wallet.address, -120, 120, initLiquidityAmount, '0x');
  //       await mockPool.mint(wallet.address, wallet.address, -1200, 1200, initLiquidityAmount, '0x');
  //       await mockPool.swapToTick(-200);

  //       expect(await plugin.incentive()).to.be.eq(await vpStub.getAddress());
  //     });
  //   });
  // });

  describe('AlgebraBasePluginV1 external methods', () => {
    describe('#changeFeeConfiguration', () => {
      const configuration = {
        alpha1: 3002,
        alpha2: 10009,
        beta1: 1001,
        beta2: 1006,
        gamma1: 20,
        gamma2: 22,
        baseFee: 150,
      };
      it('fails if caller is not factory', async () => {
        await expect(plugin.connect(other).changeFeeConfiguration(configuration)).to.be.reverted;
      });

      it('updates baseFeeConfiguration', async () => {
        await plugin.changeFeeConfiguration(configuration);

        const newConfig = await plugin.feeConfig();

        expect(newConfig.alpha1).to.eq(configuration.alpha1);
        expect(newConfig.alpha2).to.eq(configuration.alpha2);
        expect(newConfig.beta1).to.eq(configuration.beta1);
        expect(newConfig.beta2).to.eq(configuration.beta2);
        expect(newConfig.gamma1).to.eq(configuration.gamma1);
        expect(newConfig.gamma2).to.eq(configuration.gamma2);
        expect(newConfig.baseFee).to.eq(configuration.baseFee);
      });

      it('feeConfig getter gas cost [ @skip-on-coverage ]', async () => {
        await plugin.changeFeeConfiguration(configuration);
        await snapshotGasCost(plugin.feeConfig.estimateGas());
      });

      it('emits event', async () => {
        await expect(plugin.changeFeeConfiguration(configuration))
          .to.emit(plugin, 'FeeConfiguration')
          .withArgs([...Object.values(configuration)]);
      });

      it('cannot exceed max fee', async () => {
        let wrongConfig = { ...configuration };
        wrongConfig.alpha1 = 30000;
        wrongConfig.alpha2 = 30000;
        wrongConfig.baseFee = 15000;
        await expect(plugin.changeFeeConfiguration(wrongConfig)).to.be.revertedWith('Max fee exceeded');
      });

      it('cannot set zero gamma', async () => {
        let wrongConfig1 = { ...configuration };
        wrongConfig1.gamma1 = 0;
        await expect(plugin.changeFeeConfiguration(wrongConfig1)).to.be.revertedWith('Gammas must be > 0');

        let wrongConfig2 = { ...configuration };
        wrongConfig2.gamma2 = 0;
        await expect(plugin.changeFeeConfiguration(wrongConfig2)).to.be.revertedWith('Gammas must be > 0');
      });
    });
  });
});
