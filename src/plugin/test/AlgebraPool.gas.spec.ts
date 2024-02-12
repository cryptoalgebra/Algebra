import { ethers } from 'hardhat';
import { Wallet } from 'ethers';
import { loadFixture, reset as resetNetwork } from '@nomicfoundation/hardhat-network-helpers';
import { MockTimeAlgebraPool } from '../../core/typechain';
import { MockTimeAlgebraBasePluginV1, MockTimeDSFactory, MockTimeVirtualPool } from '../typechain';
import { expect } from './shared/expect';

import { algebraPoolDeployerMockFixture } from './shared/externalFixtures';

import snapshotGasCost from './shared/snapshotGasCost';

import {
  expandTo18Decimals,
  FeeAmount,
  getMinTick,
  encodePriceSqrt,
  TICK_SPACINGS,
  createPoolFunctions,
  SwapFunction,
  MintFunction,
  getMaxTick,
  MaxUint128,
  SwapToPriceFunction,
} from '../../core/test/shared/utilities';
import { ZERO_ADDRESS } from './shared/fixtures';

describe('AlgebraPool gas tests [ @skip-on-coverage ]', () => {
  let wallet: Wallet, other: Wallet;

  before('create fixture loader', async () => {
    await resetNetwork();
    [wallet, other] = await (ethers as any).getSigners();
  });

  const startingPrice = encodePriceSqrt(100001, 100000);
  const startingTick = 0;
  const tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM];
  const minTick = getMinTick(tickSpacing);
  const maxTick = getMaxTick(tickSpacing);

  async function gasTestFixture() {
    const fix = await algebraPoolDeployerMockFixture();
    const pool = await fix.createPool();

    const mockPluginFactoryFactory = await ethers.getContractFactory('MockTimeDSFactory');
    const mockPluginFactory = (await mockPluginFactoryFactory.deploy(fix.factory)) as any as MockTimeDSFactory;

    await mockPluginFactory.createPlugin(pool, ZERO_ADDRESS, ZERO_ADDRESS);
    const pluginAddress = await mockPluginFactory.pluginByPool(pool);

    const mockDSOperatorFactory = await ethers.getContractFactory('MockTimeAlgebraBasePluginV1');
    const plugin = mockDSOperatorFactory.attach(pluginAddress) as any as MockTimeAlgebraBasePluginV1;

    await pool.setPlugin(plugin);

    const advanceTime = async (secs: any) => {
      await pool.advanceTime(secs);
      await plugin.advanceTime(secs);
    };

    const { swapExact0For1, swapExact1For0, swapToHigherPrice, mint, swapToLowerPrice } = createPoolFunctions({
      swapTarget: fix.swapTargetCallee,
      token0: fix.token0,
      token1: fix.token1,
      pool,
    });

    const virtualPoolMockFactory = await ethers.getContractFactory('MockTimeVirtualPool');
    const virtualPoolMock = (await virtualPoolMockFactory.deploy()) as any as MockTimeVirtualPool;

    await pool.initialize(encodePriceSqrt(1, 1));
    await pool.setCommunityVault(wallet.address);

    await advanceTime(1);
    await mint(wallet.address, minTick, maxTick, expandTo18Decimals(2));
    await swapExact0For1(expandTo18Decimals(1), wallet.address);
    await advanceTime(1);
    await swapToHigherPrice(startingPrice, wallet.address);
    await advanceTime(1);
    expect((await pool.globalState()).tick).to.eq(startingTick);
    expect((await pool.globalState()).price).to.eq(startingPrice);

    return {
      advanceTime,
      pool,
      plugin,
      virtualPoolMock,
      mockPluginFactory,
      swapExact0For1,
      swapExact1For0,
      mint,
      swapToHigherPrice,
      swapToLowerPrice,
    };
  }

  let swapExact0For1: SwapFunction;
  let swapExact1For0: SwapFunction;
  let swapToHigherPrice: SwapToPriceFunction;
  let pool: MockTimeAlgebraPool;
  let plugin: MockTimeAlgebraBasePluginV1;
  let virtualPoolMock: MockTimeVirtualPool;
  let mockPluginFactory: MockTimeDSFactory;
  let mint: MintFunction;
  let advanceTime: any;

  for (const communityFee of [0, 60]) {
    describe(communityFee > 0 ? 'fee is on' : 'fee is off', () => {
      const gasTestCommunityFeeFixture = async () => {
        const fix = await gasTestFixture();
        if (communityFee > 0) {
          await fix.pool.setCommunityFee(communityFee);
          await fix.swapExact0For1(expandTo18Decimals(1), wallet.address);
          await fix.swapToHigherPrice(startingPrice, wallet.address);
          await fix.advanceTime(1);
        }
        await fix.advanceTime(1);
        await fix.swapExact0For1(1, wallet.address);
        await fix.advanceTime(1);
        expect((await fix.pool.globalState()).tick).to.eq(startingTick);
        return fix;
      };

      beforeEach('load the fixture', async () => {
        ({ advanceTime, swapExact0For1, swapExact1For0, pool, plugin, virtualPoolMock, mockPluginFactory, mint, swapToHigherPrice } =
          await loadFixture(gasTestCommunityFeeFixture));
      });

      describe('#swap', async () => {
        describe('#swapExact1For0', () => {
          it('first swap in block with no tick movement', async () => {
            await snapshotGasCost(swapExact1For0(2000, wallet.address));
            expect((await pool.globalState()).price).to.not.eq(startingPrice);
            expect((await pool.globalState()).tick).to.eq(startingTick);
          });

          it('first swap in block moves tick, no initialized crossings', async () => {
            await snapshotGasCost(swapExact1For0(expandTo18Decimals(1) / 10000n, wallet.address));
            expect((await pool.globalState()).tick).to.eq(startingTick + 1);
          });

          it('second swap in block with no tick movement', async () => {
            await swapExact1For0(expandTo18Decimals(1) / 10000n, wallet.address);
            expect((await pool.globalState()).tick).to.eq(startingTick + 1);
            await snapshotGasCost(swapExact1For0(2000, wallet.address));
            expect((await pool.globalState()).tick).to.eq(startingTick + 1);
          });
        });

        describe('#swapExact0For1', () => {
          it('first swap in block with no tick movement', async () => {
            await snapshotGasCost(swapExact0For1(2000, wallet.address));
            expect((await pool.globalState()).price).to.not.eq(startingPrice);
            expect((await pool.globalState()).tick).to.eq(startingTick);
          });

          it('first swap in block with no tick movement, static fee', async () => {
            await plugin.changeFeeConfiguration({
              alpha1: 0,
              alpha2: 0,
              beta1: 0,
              beta2: 0,
              gamma1: 1,
              gamma2: 1,
              baseFee: 100,
            });
            await snapshotGasCost(swapExact0For1(2000, wallet.address));
            expect((await pool.globalState()).price).to.not.eq(startingPrice);
            expect((await pool.globalState()).tick).to.eq(startingTick);
          });

          it('first swap in block moves tick, no initialized crossings', async () => {
            await snapshotGasCost(swapExact0For1(expandTo18Decimals(1) / 10000n, wallet.address));
            expect((await pool.globalState()).tick).to.eq(startingTick - 1);
          });

          it('second swap in block with no tick movement', async () => {
            await swapExact0For1(expandTo18Decimals(1) / 10000n, wallet.address);
            expect((await pool.globalState()).tick).to.eq(startingTick - 1);
            await snapshotGasCost(swapExact0For1(2000, wallet.address));
            expect((await pool.globalState()).tick).to.eq(startingTick - 1);
          });

          it('second swap in block moves tick, no initialized crossings', async () => {
            await swapExact0For1(1000, wallet.address);
            expect((await pool.globalState()).tick).to.eq(startingTick);
            await snapshotGasCost(swapExact0For1(expandTo18Decimals(1) / 10000n, wallet.address));
            expect((await pool.globalState()).tick).to.eq(startingTick - 1);
          });

          it('first swap in block, large swap, no initialized crossings', async () => {
            await snapshotGasCost(swapExact0For1(expandTo18Decimals(10), wallet.address));
            expect((await pool.globalState()).tick).to.eq(-35586);
          });

          it('first swap in block, large swap crossing several initialized ticks', async () => {
            await mint(wallet.address, startingTick - 3 * tickSpacing, startingTick - tickSpacing, expandTo18Decimals(1));
            await mint(wallet.address, startingTick - 4 * tickSpacing, startingTick - 2 * tickSpacing, expandTo18Decimals(1));
            expect((await pool.globalState()).tick).to.eq(startingTick);
            await advanceTime(15);
            await snapshotGasCost(swapExact0For1(expandTo18Decimals(1), wallet.address));
            expect((await pool.globalState()).tick).to.be.lt(startingTick - 4 * tickSpacing); // we crossed the last tick
          });

          it('several large swaps with pauses', async () => {
            await mint(wallet.address, startingTick - 3 * tickSpacing, startingTick - tickSpacing, expandTo18Decimals(1));
            await mint(wallet.address, startingTick - 4 * tickSpacing, startingTick - 2 * tickSpacing, expandTo18Decimals(1));
            expect((await pool.globalState()).tick).to.eq(startingTick);
            await swapExact0For1(expandTo18Decimals(1) / 10000n, wallet.address);
            await advanceTime(60);
            await swapExact0For1(expandTo18Decimals(1) / 10000n, wallet.address);
            await advanceTime(60 * 60);
            await swapExact1For0(expandTo18Decimals(1) / 10000n, wallet.address);
            await advanceTime(60 * 60);
            await swapExact0For1(expandTo18Decimals(1) / 10000n, wallet.address);
            await advanceTime(5 * 60 * 60);
            await swapExact1For0(expandTo18Decimals(1) / 10000n, wallet.address);
            await advanceTime(19 * 60 * 60);
            await swapExact1For0(expandTo18Decimals(1) / 10000n, wallet.address);
            await advanceTime(60);
            await snapshotGasCost(swapExact0For1(expandTo18Decimals(1), wallet.address));
            expect((await pool.globalState()).tick).to.be.lt(startingTick - 4 * tickSpacing); // we crossed the last tick
          });

          it('small swap after several large swaps with pauses', async () => {
            await mint(wallet.address, startingTick - 3 * tickSpacing, startingTick - tickSpacing, expandTo18Decimals(1));
            await mint(wallet.address, startingTick - 4 * tickSpacing, startingTick - 2 * tickSpacing, expandTo18Decimals(1));
            expect((await pool.globalState()).tick).to.eq(startingTick);
            await swapExact0For1(expandTo18Decimals(1) / 10000n, wallet.address);
            await advanceTime(60);
            await swapExact0For1(expandTo18Decimals(1) / 10000n, wallet.address);
            await advanceTime(60 * 60);
            await swapExact1For0(expandTo18Decimals(1) / 10000n, wallet.address);
            await advanceTime(60 * 60);
            await swapExact0For1(expandTo18Decimals(1) / 10000n, wallet.address);
            await advanceTime(5 * 60 * 60);
            await swapExact1For0(expandTo18Decimals(1) / 10000n, wallet.address);
            await advanceTime(19 * 60 * 60);
            await swapExact0For1(expandTo18Decimals(1) / 10000n, wallet.address);
            await advanceTime(60);
            await snapshotGasCost(swapExact0For1(1000, wallet.address));
            expect((await pool.globalState()).tick).to.be.lt(0);
          });

          it('first swap in block, large swap crossing a single initialized tick', async () => {
            await mint(wallet.address, minTick, startingTick - 2 * tickSpacing, expandTo18Decimals(1));
            await advanceTime(15);
            await snapshotGasCost(swapExact0For1(expandTo18Decimals(1), wallet.address));
            expect((await pool.globalState()).tick).to.be.lt(startingTick - 2 * tickSpacing); // we crossed the last tick
          });

          it('second swap in block, large swap crossing several initialized ticks', async () => {
            await mint(wallet.address, startingTick - 3 * tickSpacing, startingTick - tickSpacing, expandTo18Decimals(1));
            await mint(wallet.address, startingTick - 4 * tickSpacing, startingTick - 2 * tickSpacing, expandTo18Decimals(1));
            await swapExact0For1(expandTo18Decimals(1) / 10000n, wallet.address);
            await snapshotGasCost(swapExact0For1(expandTo18Decimals(1), wallet.address));
            expect((await pool.globalState()).tick).to.be.lt(startingTick - 4 * tickSpacing);
          });

          it('second swap in block, large swap crossing a single initialized tick', async () => {
            await mint(wallet.address, minTick, startingTick - 2 * tickSpacing, expandTo18Decimals(1));
            await swapExact0For1(expandTo18Decimals(1) / 10000n, wallet.address);
            expect((await pool.globalState()).tick).to.be.gt(startingTick - 2 * tickSpacing); // we didn't cross the initialized tick
            await snapshotGasCost(swapExact0For1(expandTo18Decimals(1), wallet.address));
            expect((await pool.globalState()).tick).to.be.lt(startingTick - 2 * tickSpacing); // we crossed the last tick
          });

          it('large swap crossing several initialized ticks after some time passes', async () => {
            await mint(wallet.address, startingTick - 3 * tickSpacing, startingTick - tickSpacing, expandTo18Decimals(1));
            await mint(wallet.address, startingTick - 4 * tickSpacing, startingTick - 2 * tickSpacing, expandTo18Decimals(1));
            await swapExact0For1(2, wallet.address);
            await advanceTime(1);
            await snapshotGasCost(swapExact0For1(expandTo18Decimals(1), wallet.address));
            expect((await pool.globalState()).tick).to.be.lt(startingTick - 4 * tickSpacing);
          });

          it('large swap crossing several initialized ticks second time after some time passes', async () => {
            await mint(wallet.address, startingTick - 3 * tickSpacing, startingTick - tickSpacing, expandTo18Decimals(1));
            await mint(wallet.address, startingTick - 4 * tickSpacing, startingTick - 2 * tickSpacing, expandTo18Decimals(1));
            await swapExact0For1(expandTo18Decimals(1), wallet.address);
            await swapToHigherPrice(startingPrice, wallet.address);
            await advanceTime(1);
            await snapshotGasCost(swapExact0For1(expandTo18Decimals(1), wallet.address));
            expect((await pool.globalState()).tick).to.be.lt(tickSpacing * -4);
          });
        });

        describe('farming connected', async () => {
          beforeEach('connect virtual pool', async () => {
            await mockPluginFactory.setFarmingAddress(wallet);
            await plugin.connect(wallet).setIncentive(virtualPoolMock);
          });

          it('first swap in block with no tick movement', async () => {
            await snapshotGasCost(swapExact1For0(2000, wallet.address));
            expect((await pool.globalState()).price).to.not.eq(startingPrice);
            expect((await pool.globalState()).tick).to.eq(startingTick);
          });

          it('first swap in block moves tick, no initialized crossings', async () => {
            await snapshotGasCost(swapExact1For0(expandTo18Decimals(1) / 10000n, wallet.address));
            expect((await pool.globalState()).tick).to.eq(startingTick + 1);
          });

          it('second swap in block with no tick movement', async () => {
            await swapExact1For0(expandTo18Decimals(1) / 10000n, wallet.address);
            expect((await pool.globalState()).tick).to.eq(startingTick + 1);
            await snapshotGasCost(swapExact1For0(2000, wallet.address));
            expect((await pool.globalState()).tick).to.eq(startingTick + 1);
          });
        });
      });
    });
  }

  describe('Positions', function () {
    beforeEach('load inner fixture', async () => {
      ({ advanceTime, swapExact0For1, swapExact1For0, pool, plugin, virtualPoolMock, mockPluginFactory, mint, swapToHigherPrice } = await loadFixture(
        gasTestFixture
      ));
    });

    describe('#mint', () => {
      for (const { description, bottomTick, topTick } of [
        {
          description: 'around current price',
          bottomTick: startingTick - tickSpacing,
          topTick: startingTick + tickSpacing,
        },
        {
          description: 'below current price',
          bottomTick: startingTick - 2 * tickSpacing,
          topTick: startingTick - tickSpacing,
        },
        {
          description: 'above current price',
          bottomTick: startingTick + tickSpacing,
          topTick: startingTick + 2 * tickSpacing,
        },
      ]) {
        describe(description, () => {
          it('new position mint first in range', async () => {
            await advanceTime(15);
            await snapshotGasCost(mint(wallet.address, bottomTick, topTick, expandTo18Decimals(1)));
          });
          it('add to position existing', async () => {
            await mint(wallet.address, bottomTick, topTick, expandTo18Decimals(1));
            await advanceTime(15);
            await snapshotGasCost(mint(wallet.address, bottomTick, topTick, expandTo18Decimals(1)));
          });
          it('second position in same range', async () => {
            await mint(wallet.address, bottomTick, topTick, expandTo18Decimals(1));
            await advanceTime(15);
            await snapshotGasCost(mint(other.address, bottomTick, topTick, expandTo18Decimals(1)));
          });
        });
      }
    });

    describe('#burn', () => {
      for (const { description, bottomTick, topTick } of [
        {
          description: 'around current price',
          bottomTick: startingTick - tickSpacing,
          topTick: startingTick + tickSpacing,
        },
        {
          description: 'below current price',
          bottomTick: startingTick - 2 * tickSpacing,
          topTick: startingTick - tickSpacing,
        },
        {
          description: 'above current price',
          bottomTick: startingTick + tickSpacing,
          topTick: startingTick + 2 * tickSpacing,
        },
      ]) {
        describe(description, () => {
          const liquidityAmount = expandTo18Decimals(1);
          beforeEach('mint a position', async () => {
            await mint(wallet.address, bottomTick, topTick, liquidityAmount);
            await advanceTime(15);
          });

          it('burn when only position using ticks', async () => {
            await snapshotGasCost(pool.burn(bottomTick, topTick, expandTo18Decimals(1), '0x'));
          });
          it('partial position burn', async () => {
            await snapshotGasCost(pool.burn(bottomTick, topTick, expandTo18Decimals(1) / 2n, '0x'));
          });
          it('entire position burn but other positions are using the ticks', async () => {
            await mint(other.address, bottomTick, topTick, expandTo18Decimals(1));
            await advanceTime(15);
            await snapshotGasCost(pool.burn(bottomTick, topTick, expandTo18Decimals(1), '0x'));
          });
        });
      }
    });

    describe('#poke', () => {
      const bottomTick = startingTick - tickSpacing;
      const topTick = startingTick + tickSpacing;

      it('best case', async () => {
        await mint(wallet.address, bottomTick, topTick, expandTo18Decimals(1));
        await swapExact0For1(expandTo18Decimals(1) / 100n, wallet.address);
        await pool.burn(bottomTick, topTick, 0, '0x');
        await swapExact0For1(expandTo18Decimals(1) / 100n, wallet.address);
        await advanceTime(15);
        await snapshotGasCost(pool.burn(bottomTick, topTick, 0, '0x'));
      });
    });

    describe('#collect', () => {
      const bottomTick = startingTick - tickSpacing;
      const topTick = startingTick + tickSpacing;

      it('close to worst case', async () => {
        await mint(wallet.address, bottomTick, topTick, expandTo18Decimals(1));
        await swapExact0For1(expandTo18Decimals(1) / 100n, wallet.address);
        await pool.burn(bottomTick, topTick, 0, '0x'); // poke to accumulate fees
        await advanceTime(15);
        await snapshotGasCost(pool.collect(wallet.address, bottomTick, topTick, MaxUint128, MaxUint128));
      });

      it('close to worst case, two tokens', async () => {
        await mint(wallet.address, bottomTick, topTick, expandTo18Decimals(1));
        await swapExact0For1(expandTo18Decimals(1) / 100n, wallet.address);
        await swapExact1For0(expandTo18Decimals(1) / 100n, wallet.address);
        await pool.burn(bottomTick, topTick, 0, '0x'); // poke to accumulate fees
        await advanceTime(15);
        await snapshotGasCost(pool.collect(wallet.address, bottomTick, topTick, MaxUint128, MaxUint128));
      });
    });
  });

  describe('Filled VolatilityOracle', function () {
    this.timeout(600_000);

    const filledStorageFixture = async () => {
      const fix = await gasTestFixture();
      await fix.advanceTime(15);
      await fix.mint(wallet.address, startingTick - 3 * tickSpacing, startingTick - tickSpacing, expandTo18Decimals(1));
      await fix.mint(wallet.address, startingTick - 4 * tickSpacing, startingTick - 2 * tickSpacing, expandTo18Decimals(1));
      await fix.swapExact0For1(1, wallet.address);
      expect((await fix.pool.globalState()).tick).to.eq(startingTick);

      const BATCH_SIZE = 300;
      let summaryTimeDelta = 0;
      for (let i = 0; i < 1500; i += BATCH_SIZE) {
        const batch = [];
        for (let j = 0; j < BATCH_SIZE; j++) {
          const timeDelta = (i + j) % 2 == 0 ? 60 : 90;
          summaryTimeDelta += timeDelta;
          batch.push({
            advanceTimeBy: timeDelta,
            tick: startingTick + i - j,
          });
        }
        await fix.plugin.batchUpdate(batch);
      }
      await fix.pool.advanceTime(summaryTimeDelta);

      return fix;
    };

    beforeEach('load inner fixture', async () => {
      ({ advanceTime, swapExact0For1, swapExact1For0, pool, plugin, virtualPoolMock, mockPluginFactory, mint, swapToHigherPrice } = await loadFixture(
        filledStorageFixture
      ));
    });

    describe('swaps', async () => {
      for (const isDynamicFee of [true, false]) {
        describe(isDynamicFee ? 'dynamic fee' : 'static fee', async () => {
          beforeEach(async () => {
            if (!isDynamicFee) {
              await plugin.changeFeeConfiguration({
                alpha1: 0,
                alpha2: 0,
                beta1: 0,
                beta2: 0,
                gamma1: 1,
                gamma2: 1,
                baseFee: 100,
              });
              await advanceTime(15);
              await swapExact0For1(1000, wallet.address);
            }
          });

          it('small swap with filled volatilityOracle', async () => {
            await advanceTime(15);
            await snapshotGasCost(swapExact0For1(1000, wallet.address));
          });

          it('small swap with filled volatilityOracle after 4h', async () => {
            await advanceTime(4 * 60 * 60);
            await snapshotGasCost(swapExact0For1(1000, wallet.address));
          });

          it('small swap with filled volatilityOracle after 8h', async () => {
            await advanceTime(8 * 60 * 60);
            await snapshotGasCost(swapExact0For1(1000, wallet.address));
          });

          it('small swap with filled volatilityOracle after 24h', async () => {
            await advanceTime(24 * 60 * 60 - 1);
            await swapExact0For1(1, wallet.address);
            await advanceTime(5);
            await snapshotGasCost(swapExact0For1(1000, wallet.address));
          });

          it('large swap crossing several initialized ticks', async () => {
            await advanceTime(15);
            await mint(wallet.address, startingTick - 3 * tickSpacing, startingTick - tickSpacing, expandTo18Decimals(1));
            await mint(wallet.address, startingTick - 4 * tickSpacing, startingTick - 2 * tickSpacing, expandTo18Decimals(1));
            await swapExact0For1(2, wallet.address);
            await advanceTime(15);
            await snapshotGasCost(swapExact0For1(expandTo18Decimals(1), wallet.address));
            expect((await pool.globalState()).tick).to.be.lt(startingTick - 4 * tickSpacing);
          });
        });
      }
    });
  });
});
