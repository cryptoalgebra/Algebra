import { ethers } from 'hardhat';
import { Wallet } from 'ethers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect, blockTimestamp, snapshotGasCost, ZERO_ADDRESS} from '../shared';

import { createTimeMachine } from '../shared/time';

import { PoolMock, TestVirtualPool, TestERC20} from '../../typechain';

const MIN_TICK = -887272;
const MAX_TICK = 887272;

describe('unit/EternalVirtualPool', () => {
  let pseudoFarming: Wallet;

  const Time = createTimeMachine();

  let poolMock: PoolMock;
  let virtualPool: TestVirtualPool;

  let rewardTokenAddress: string;
  let initTimestamp: number;

  before(async () => {
    const wallets = (await ethers.getSigners()) as any as Wallet[];
    pseudoFarming = wallets[1];
  });

  const virtualPoolFixture: () => Promise<{ poolMock: PoolMock; virtualPool: TestVirtualPool; initTimestamp: number , rewardTokenAddress: string}> = async () => {
    const _blockTimestamp = await blockTimestamp();
    const _initTimestamp = _blockTimestamp + 1000000;

    const poolMockFactory = await ethers.getContractFactory('PoolMock');
    const _poolMock = (await poolMockFactory.deploy()) as any as PoolMock;

    const token = await ethers.getContractFactory('TestERC20')
    const _token = (await token.deploy(2n**128n)) as any as TestERC20
    let _rewardTokenAddress = await _token.getAddress()
    await Time.set(_initTimestamp);

    const virtualPoolFactory = await ethers.getContractFactory('TestVirtualPool');
    const _virtualPool = (await virtualPoolFactory.deploy(pseudoFarming.address, _poolMock)) as any as TestVirtualPool;

    await _virtualPool.connect(pseudoFarming).addRewardToken(_rewardTokenAddress)

    return {
      poolMock: _poolMock,
      virtualPool: _virtualPool,
      initTimestamp: _initTimestamp,
      rewardTokenAddress: _rewardTokenAddress
    };
  };

  beforeEach('load fixture', async () => {
    ({ poolMock, virtualPool, initTimestamp, rewardTokenAddress } = await loadFixture(virtualPoolFixture));
  });

  it('cannot call onlyFarming methods as not farming', async () => {
    await expect(virtualPool.addRewards(rewardTokenAddress, 100)).to.be.revertedWithCustomError(virtualPool, 'onlyFarming');
    await expect(virtualPool.decreaseRewards(rewardTokenAddress, 100)).to.be.revertedWithCustomError(virtualPool, 'onlyFarming');
    await expect(virtualPool.distributeRewards()).to.be.revertedWithCustomError(virtualPool, 'onlyFarming');
    await expect(virtualPool.applyLiquidityDeltaToPosition(100, 110, 100, 100)).to.be.revertedWithCustomError(virtualPool, 'onlyFarming');
    await expect(virtualPool.setRates(rewardTokenAddress, 100)).to.be.revertedWithCustomError(virtualPool, 'onlyFarming');
    await expect(virtualPool.deactivate()).to.be.revertedWithCustomError(virtualPool, 'onlyFarming');
  });

  it('has correct init configuration', async () => {
    const farmingAddress = await virtualPool.farmingAddress();
    expect(farmingAddress).to.be.eq(pseudoFarming.address);

    const poolAddress = await virtualPool.plugin();
    expect(poolAddress).to.be.eq(await poolMock.getAddress());

    const liquidity = await virtualPool.currentLiquidity();
    expect(liquidity).to.be.eq(0);

    const tick = await virtualPool.globalTick();
    expect(tick).to.be.eq(0);

    const prevTimestamp = await virtualPool.prevTimestamp();
    expect(prevTimestamp).to.be.eq(initTimestamp);

    const rewardRate = await virtualPool.rewardRate(rewardTokenAddress);
    expect(rewardRate).to.be.eq(0);

    const rewardReserve = await virtualPool.rewardReserve(rewardTokenAddress);
    expect(rewardReserve).to.be.eq(0);

    const totalRewardGrowth = await virtualPool.totalRewardGrowth(rewardTokenAddress);
    expect(totalRewardGrowth).to.be.eq(1);
  });

  describe('#add and decrease rewards', async () => {
    it('add rewards works', async () => {
      await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 101);

      const rewardReserve = await virtualPool.rewardReserve(rewardTokenAddress);
      expect(rewardReserve).to.be.eq(101);
    });

    it('add rewards cannot overflow', async () => {
      await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 2n ** 128n - 10n);

      const rewardReserve = await virtualPool.rewardReserve(rewardTokenAddress);
      expect(rewardReserve).to.be.eq(2n ** 128n - 10n);

      await expect(virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 10)).to.be.revertedWithPanic();
    });

    it('decrease rewards works', async () => {
      await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 101);

      await virtualPool.connect(pseudoFarming).decreaseRewards(rewardTokenAddress, 40);
      const rewardReserve = await virtualPool.rewardReserve(rewardTokenAddress);
      expect(rewardReserve).to.be.eq(61);
    });

    it('decrease rewards cannot underflow', async () => {
      await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 101);

      await expect(virtualPool.connect(pseudoFarming).decreaseRewards(rewardTokenAddress, 102)).to.be.revertedWithPanic();
    });

    it('works with zero args', async () => {
      await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 0);
      const rewardReserve = await virtualPool.rewardReserve(rewardTokenAddress);
      expect(rewardReserve).to.be.eq(0);

      await virtualPool.connect(pseudoFarming).decreaseRewards(rewardTokenAddress, 0);
      const rewardReserve1 = await virtualPool.rewardReserve(rewardTokenAddress);
      expect(rewardReserve1).to.be.eq(0);
    });
  });

  describe('#applyLiquidityDeltaToPosition', async () => {
    it('increases liquidity if in-range', async () => {
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

      const liquidity = await virtualPool.currentLiquidity();
      expect(liquidity).to.be.eq(1000);

      const timestamp = await virtualPool.prevTimestamp();
      expect(timestamp).to.be.gt(initTimestamp);
    });

    it('can add liquidity to existing in-range position', async () => {
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 100, 1);

      const liquidity = await virtualPool.currentLiquidity();
      expect(liquidity).to.be.eq(1100);

      const timestamp = await virtualPool.prevTimestamp();
      expect(timestamp).to.be.gt(initTimestamp);
    });

    it('does not increase liquidity if out-of-range', async () => {
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, -101);

      const liquidity = await virtualPool.currentLiquidity();
      expect(liquidity).to.be.eq(0);

      const timestamp = await virtualPool.prevTimestamp();
      expect(timestamp).to.be.gt(initTimestamp);
    });

    it('can create overlapping positions', async () => {
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(100, 200, 1000, 1);

      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-200, -100, 1000, 1);

      const liquidity = await virtualPool.currentLiquidity();
      expect(liquidity).to.be.eq(1000);

      const timestamp = await virtualPool.prevTimestamp();
      expect(timestamp).to.be.gt(initTimestamp);
    });

    it('cannot overflow liquidity if out-of range', async () => {
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 191757638537527648490752896198552n, -101);

      const liquidity = await virtualPool.currentLiquidity();
      expect(liquidity).to.be.eq(0);

      await expect(virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 2n, -101)).to.be.revertedWithCustomError(
        virtualPool,
        'liquidityOverflow'
      );
    });

    it('can add 0 liquidity', async () => {
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 0, 1);

      const liquidity = await virtualPool.currentLiquidity();
      expect(liquidity).to.be.eq(0);
    });

    it('can remove out-of-range position', async () => {
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 0, 1);

      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(1000, 1010, 100, 1);

      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(80, 150, 100, 1);

      let tickUpperData = await virtualPool.ticks(1010);
      let tickLowerData = await virtualPool.ticks(1000);
      expect(tickUpperData.liquidityTotal).to.be.eq(100);
      expect(tickLowerData.liquidityTotal).to.be.eq(100);

      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(1000, 1010, -100, 1);

      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(80, 150, -100, 1);

      tickUpperData = await virtualPool.ticks(1010);
      tickLowerData = await virtualPool.ticks(1000);
      expect(tickUpperData.liquidityTotal).to.be.eq(0);
      expect(tickLowerData.liquidityTotal).to.be.eq(0);
    });

    it('can create and remove positions with min and max ticks', async () => {
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(MIN_TICK, MAX_TICK, 1000, 1);

      let liquidity = await virtualPool.currentLiquidity();
      expect(liquidity).to.be.eq(1000);

      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(MIN_TICK, 10, 1010, 1);

      liquidity = await virtualPool.currentLiquidity();
      expect(liquidity).to.be.eq(2010);

      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-10, MAX_TICK, 1001, 1);

      liquidity = await virtualPool.currentLiquidity();
      expect(liquidity).to.be.eq(3011);

      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-10, MAX_TICK, -1001, 1);

      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(MIN_TICK, 10, -1010, 1);

      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(MIN_TICK, MAX_TICK, -1000, 1);

      liquidity = await virtualPool.currentLiquidity();
      expect(liquidity).to.be.eq(0);
    });

    it('deactivates virtual pool if new tick is higher than should be', async () => {
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1, 0);

      expect(await virtualPool.deactivated()).to.be.false;

      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-110, 110, 1, 105);

      expect(await virtualPool.deactivated()).to.be.true;
      expect(await virtualPool.globalTick()).to.be.eq(0);
    });

    it('deactivates virtual pool if new tick is lower than should be', async () => {
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1, 0);

      expect(await virtualPool.deactivated()).to.be.false;

      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-110, 110, 1, -105);

      expect(await virtualPool.deactivated()).to.be.true;
      expect(await virtualPool.globalTick()).to.be.eq(0);
    });
  });

  describe('#distributeRewards', async () => {
    it('does not distribute anything if zero liquidity', async () => {
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-200, -10, 1000, 1);

      await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 100);
      await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 10000);

      const timestamp = await blockTimestamp();
      await Time.setAndMine(timestamp + 10000);

      await virtualPool.connect(pseudoFarming).distributeRewards();

      const reserve = await virtualPool.rewardReserve(rewardTokenAddress);
      expect(reserve).to.be.eq(10000);

      const totalRewardGrowth = await virtualPool.totalRewardGrowth(rewardTokenAddress);
      expect(totalRewardGrowth).to.be.eq(1);
    });

    it('distributes all rewards correctly in normal case', async () => {
      await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 100);
      await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 10000);

      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

      const timestamp = await blockTimestamp();
      await Time.setAndMine(timestamp + 10000);

      await virtualPool.connect(pseudoFarming).distributeRewards();

      const reserve = await virtualPool.rewardReserve(rewardTokenAddress);
      expect(reserve).to.be.eq(0);

      let totalRewardGrowth = await virtualPool.totalRewardGrowth(rewardTokenAddress);
      expect(totalRewardGrowth).to.be.eq(3402823669209384634633746074317682114561n);

      await virtualPool.connect(pseudoFarming).distributeRewards();

      totalRewardGrowth = await virtualPool.totalRewardGrowth(rewardTokenAddress);
      expect(totalRewardGrowth).to.be.eq(3402823669209384634633746074317682114561n);
    });

    it('can distribute reward0 only', async () => {
      await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 100);
      await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 10000);

      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

      const timestamp = await blockTimestamp();
      await Time.setAndMine(timestamp + 10000);

      await virtualPool.connect(pseudoFarming).distributeRewards();

      const reserve = await virtualPool.rewardReserve(rewardTokenAddress);
      expect(reserve).to.be.eq(0);

      let totalRewardGrowth = await virtualPool.totalRewardGrowth(rewardTokenAddress);
      expect(totalRewardGrowth).to.be.eq(3402823669209384634633746074317682114561n);

      await virtualPool.connect(pseudoFarming).distributeRewards();

      totalRewardGrowth = await virtualPool.totalRewardGrowth(rewardTokenAddress);
      expect(totalRewardGrowth).to.be.eq(3402823669209384634633746074317682114561n);
    });

  });

  describe('#getInnerRewardsGrowth', async () => {
    it('reverts if ticks are invalid', async () => {
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-200, 100, 1000, 1);

      await expect(virtualPool.getInnerRewardsGrowth(-220, 220, rewardTokenAddress)).to.be.revertedWithCustomError(virtualPool, 'tickIsNotInitialized');
      await expect(virtualPool.getInnerRewardsGrowth(-220, -200, rewardTokenAddress)).to.be.revertedWithCustomError(virtualPool, 'tickIsNotInitialized');
      await expect(virtualPool.getInnerRewardsGrowth(100, 120, rewardTokenAddress)).to.be.revertedWithCustomError(virtualPool, 'tickIsNotInitialized');
    });

    it('works with actual timedelta', async () => {
      await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 100);
      await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 10000);

      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

      const timestamp = await blockTimestamp();
      await Time.setAndMine(timestamp + 10000);

      const innerRewardsGrowth = await virtualPool.getInnerRewardsGrowth(-100, 100, rewardTokenAddress);

      expect(innerRewardsGrowth).to.be.eq(3402823669209384634633746074317682114560n);
    });

    it('works with actual timedelta and 0 active liquidity', async () => {
      await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 100);
      await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 10000);

      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 101);

      const timestamp = await blockTimestamp();
      await Time.setAndMine(timestamp + 10000);

      const innerRewardsGrowth = await virtualPool.getInnerRewardsGrowth(-100, 100, rewardTokenAddress);

      expect(innerRewardsGrowth).to.be.eq(0);
    });

    it('works with actual timedelta with partial distribution', async () => {
      await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 1);
      await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 1000000);

      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

      const timestamp = await blockTimestamp();
      await Time.setAndMine(timestamp + 1000);

      const innerRewardsGrowth = await virtualPool.getInnerRewardsGrowth(-100, 100, rewardTokenAddress);

      expect(innerRewardsGrowth).to.be.gt(0);
    });

    it('works with actual timedelta if rates are zero', async () => {
      await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 0);
      await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 1000000);

      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

      const timestamp = await blockTimestamp();
      await Time.setAndMine(timestamp + 1000);

      const innerRewardsGrowth = await virtualPool.getInnerRewardsGrowth(-100, 100, rewardTokenAddress);

      expect(innerRewardsGrowth).to.be.eq(0);
    });
  });

  describe('#crossTo', async () => {
    it('reverts if not from pool', async () => {
      await expect(virtualPool.crossTo(100, true, 10)).to.be.revertedWithCustomError(virtualPool, 'onlyPlugin');
    });

    describe('otz', async () => {
      it('without cross', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

        await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 1);
        await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 1);

        const timestamp = await blockTimestamp();
        await Time.setAndMine(timestamp + 10000);

        await poolMock.crossTo(50, false);

        const globalTick = await virtualPool.globalTick();
        expect(globalTick).to.be.eq(1);

        expect(await virtualPool.deactivated()).to.be.false;

        const tickDataAfter = await virtualPool.getTickGrowth(100, rewardTokenAddress);
        expect(tickDataAfter).to.be.eq(0n);

        expect(await virtualPool.nextTick()).to.be.eq(100);
        expect(await virtualPool.prevTick()).to.be.eq(-100);
      });

      it('can cross one tick otz', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

        await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 1);
        await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 1);
        await poolMock.crossTo(101, false);

        const globalTick = await virtualPool.globalTick();
        expect(globalTick).to.be.eq(101);

        const tickDataAfter = await virtualPool.getTickGrowth(100, rewardTokenAddress);
        console.log(tickDataAfter)
        expect(tickDataAfter).to.be.eq((1n * 2n ** 128n) / 1000n + 1n);

        expect(await virtualPool.nextTick()).to.be.eq(MAX_TICK);
        expect(await virtualPool.prevTick()).to.be.eq(100);
      });

      it('can cross one tick otz, next is before max tick', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(MIN_TICK + 1, MAX_TICK - 1, 1000, 1);

        await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 1);
        await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 1);

        await poolMock.crossTo(101, false);
        const globalTick = await virtualPool.globalTick();
        expect(globalTick).to.be.eq(101);

        const tickDataAfter = await virtualPool.getTickGrowth(100, rewardTokenAddress);
        expect(tickDataAfter).to.be.eq((1n * 2n ** 128n) / 2000n + 1n);

        expect(await virtualPool.nextTick()).to.be.eq(MAX_TICK - 1);
        expect(await virtualPool.prevTick()).to.be.eq(100);
      });

      it('can cross two ticks otz', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-110, 110, 1000, 1);

        await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 1);
        await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 1);

        await poolMock.crossTo(111, false);
        const globalTick = await virtualPool.globalTick();
        expect(globalTick).to.be.eq(111);

        const tickDataAfter = await virtualPool.getTickGrowth(110, rewardTokenAddress);
        expect(tickDataAfter).to.be.eq((1n * 2n ** 128n) / 2000n + 1n);

        expect(await virtualPool.nextTick()).to.be.eq(MAX_TICK);
        expect(await virtualPool.prevTick()).to.be.eq(110);
      });

      it('can cross to maxTick - 1', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(MIN_TICK + 1, MAX_TICK - 1, 1000, 1);

        await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 1);
        await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 1);

        await poolMock.crossTo(MAX_TICK - 1, false);
        const globalTick = await virtualPool.globalTick();
        expect(globalTick).to.be.eq(MAX_TICK - 1);

        const tickDataAfter = await virtualPool.getTickGrowth(MAX_TICK - 1, rewardTokenAddress);
        expect(tickDataAfter).to.be.eq((1n * 2n ** 128n) / 2000n + 1n);

        expect(await virtualPool.nextTick()).to.be.eq(MAX_TICK);
        expect(await virtualPool.prevTick()).to.be.eq(MAX_TICK - 1);
      });

      it('deactivates if invalid direction', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

        await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 1);
        await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 1);

        expect(await virtualPool.deactivated()).to.be.false;
        await poolMock.crossTo(-101, false);
        const globalTick = await virtualPool.globalTick();
        expect(globalTick).to.be.eq(1);
        expect(await virtualPool.deactivated()).to.be.true;
      });

      it('returns if deactivated', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

        await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 1);
        await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 1);
        await virtualPool.connect(pseudoFarming).deactivate();

        await poolMock.crossTo(101, false);

        const globalTick = await virtualPool.globalTick();
        expect(globalTick).to.be.eq(1);
        expect(await virtualPool.deactivated()).to.be.true;
      });

      it('does not deactivate if crossTo current tick', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(1, 100, 1000, 1);

        await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 1);
        await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 1);

        await poolMock.crossTo(1, false);

        const globalTick = await virtualPool.globalTick();
        expect(globalTick).to.be.eq(1);
        expect(await virtualPool.deactivated()).to.be.false;
      });

      it('crosses tick twice if zto after otz', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-600, 240, 1000, -1);
        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(0, 240, 1000, -1);

        await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 100);
        await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 100);

        const timestamp = await blockTimestamp();
        await Time.setAndMine(timestamp + 1000);

        await poolMock.crossTo(6, false);

        expect(await virtualPool.globalTick()).to.be.eq(6);

        const tickData = await virtualPool.getTickGrowth(0, rewardTokenAddress);;

        expect(await virtualPool.nextTick()).to.be.eq(240);
        expect(await virtualPool.prevTick()).to.be.eq(0);

        expect(tickData).to.be.not.eq(1n);

        await poolMock.crossTo(-6, true);

        expect(await virtualPool.globalTick()).to.be.eq(-6);

        const tickDataAfter = await virtualPool.getTickGrowth(0, rewardTokenAddress);;

        expect(await virtualPool.nextTick()).to.be.eq(0);
        expect(await virtualPool.prevTick()).to.be.eq(-600);

        expect(tickDataAfter).to.be.eq(0);

        expect(await virtualPool.deactivated()).to.be.false;
      });
    });

    describe('zto', async () => {
      it('without cross', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

        await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 1);
        await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 1);

        const timestamp = await blockTimestamp();
        await Time.setAndMine(timestamp + 10000);

        await poolMock.crossTo(-50, true);

        const globalTick = await virtualPool.globalTick();
        expect(globalTick).to.be.eq(1);

        expect(await virtualPool.deactivated()).to.be.false;

        const tickDataAfter = await virtualPool.getTickGrowth(-100, rewardTokenAddress);
        expect(tickDataAfter).to.be.eq(1n);

        expect(await virtualPool.nextTick()).to.be.eq(100);
        expect(await virtualPool.prevTick()).to.be.eq(-100);
      });

      it('can cross one tick zto', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

        await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 1);
        await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 1);

        await poolMock.crossTo(-101, true);
        const globalTick = await virtualPool.globalTick();
        expect(globalTick).to.be.eq(-101);

        const tickDataAfter = await virtualPool.getTickGrowth(-100, rewardTokenAddress);
        expect(tickDataAfter).to.be.eq((1n * 2n ** 128n) / 1000n);

        expect(await virtualPool.nextTick()).to.be.eq(-100);
        expect(await virtualPool.prevTick()).to.be.eq(MIN_TICK);
      });

      it('can cross one tick zto, next is after min tick', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(MIN_TICK + 1, MAX_TICK - 1, 1000, 1);

        await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 1);
        await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 1);

        await poolMock.crossTo(-101, true);
        const globalTick = await virtualPool.globalTick();
        expect(globalTick).to.be.eq(-101);

        const tickDataAfter = await virtualPool.getTickGrowth(-100, rewardTokenAddress);
        expect(tickDataAfter).to.be.eq((1n * 2n ** 128n) / 2000n);

        expect(await virtualPool.nextTick()).to.be.eq(-100);
        expect(await virtualPool.prevTick()).to.be.eq(MIN_TICK + 1);
      });

      it('can cross two ticks zto', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-110, 110, 1000, 1);

        await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 1);
        await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 1);

        await poolMock.crossTo(-111, true);
        const globalTick = await virtualPool.globalTick();
        expect(globalTick).to.be.eq(-111);

        const tickDataAfter = await virtualPool.getTickGrowth(-110, rewardTokenAddress);
        expect(tickDataAfter).to.be.eq((1n * 2n ** 128n) / 2000n);

        expect(await virtualPool.nextTick()).to.be.eq(-110);
        expect(await virtualPool.prevTick()).to.be.eq(MIN_TICK);
      });

      it('can cross to minTick, last is min tick + 1', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(MIN_TICK + 1, MAX_TICK - 1, 1000, 1);

        await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 1);
        await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 1);

        await poolMock.crossTo(MIN_TICK, true);
        const globalTick = await virtualPool.globalTick();
        expect(globalTick).to.be.eq(MIN_TICK);

        const tickDataAfter = await virtualPool.getTickGrowth(MIN_TICK + 1, rewardTokenAddress);
        expect(tickDataAfter).to.be.eq((1n * 2n ** 128n) / 2000n);

        expect(await virtualPool.nextTick()).to.be.eq(MIN_TICK + 1);
        expect(await virtualPool.prevTick()).to.be.eq(MIN_TICK);
      });

      it('can cross to min tick + 1', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(MIN_TICK + 1, MAX_TICK - 1, 1000, 1);

        await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 1);
        await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 1);

        await poolMock.crossTo(MIN_TICK + 1, true);
        const globalTick = await virtualPool.globalTick();
        expect(globalTick).to.be.eq(MIN_TICK + 1);

        const tickDataCrossed = await virtualPool.getTickGrowth(-100, rewardTokenAddress);
        expect(tickDataCrossed).to.be.eq((1n * 2n ** 128n) / 2000n);

        const tickDataNotCrossed = await virtualPool.getTickGrowth(MIN_TICK + 1, rewardTokenAddress);
        expect(tickDataNotCrossed).to.be.eq(1n);

        expect(await virtualPool.nextTick()).to.be.eq(-100);
        expect(await virtualPool.prevTick()).to.be.eq(MIN_TICK + 1);
      });

      it('can cross to minTick', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(MIN_TICK + 1, MAX_TICK - 1, 1000, 1);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(MIN_TICK, MAX_TICK, 1000, 1);

        await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 1);
        await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 1);

        await poolMock.crossTo(MIN_TICK, true);
        const globalTick = await virtualPool.globalTick();
        expect(globalTick).to.be.eq(MIN_TICK);

        const tickDataAfter = await virtualPool.getTickGrowth(MIN_TICK + 1, rewardTokenAddress);
        expect(tickDataAfter).to.be.eq((1n * 2n ** 128n) / 3000n);

        const tickDataMin = await virtualPool.getTickGrowth(MIN_TICK, rewardTokenAddress);
        expect(tickDataMin).to.be.eq(1n);

        expect(await virtualPool.nextTick()).to.be.eq(MIN_TICK + 1);
        expect(await virtualPool.prevTick()).to.be.eq(MIN_TICK);
      });

      it('deactivates if invalid direction', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

        await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 1);
        await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 1);

        await poolMock.crossTo(99, true);
        expect(await virtualPool.deactivated()).to.be.false;

        await poolMock.crossTo(100, true);
        const globalTick = await virtualPool.globalTick();
        expect(globalTick).to.be.eq(1);
        expect(await virtualPool.deactivated()).to.be.true;
      });

      it('returns if deactivated', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

        await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 1);
        await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 1);
        await virtualPool.connect(pseudoFarming).deactivate();

        await poolMock.crossTo(-101, true);

        const globalTick = await virtualPool.globalTick();
        expect(globalTick).to.be.eq(1);
        expect(await virtualPool.deactivated()).to.be.true;
      });

      it('does not deactivate if crossTo current tick', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

        await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 1);
        await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 1);

        await poolMock.crossTo(1, true);

        const globalTick = await virtualPool.globalTick();
        expect(globalTick).to.be.eq(1);
        expect(await virtualPool.deactivated()).to.be.false;

        expect(await virtualPool.nextTick()).to.be.eq(100);
        expect(await virtualPool.prevTick()).to.be.eq(-100);
      });

      it('crosses tick twice if otz after zto', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-600, 240, 1000, 1);
        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(0, 240, 1000, 1);

        await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 100);
        await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 100);

        const timestamp = await blockTimestamp();
        await Time.setAndMine(timestamp + 1000);

        await poolMock.crossTo(-6, true);

        expect(await virtualPool.globalTick()).to.be.eq(-6);

        const tickData = await virtualPool.getTickGrowth(0, rewardTokenAddress);

        expect(tickData).to.be.not.eq(0n);
        expect(tickData).to.be.not.eq(0n);

        expect(await virtualPool.nextTick()).to.be.eq(0);
        expect(await virtualPool.prevTick()).to.be.eq(-600);

        await poolMock.crossTo(6, false);

        expect(await virtualPool.globalTick()).to.be.eq(6);

        const tickDataAfter = await virtualPool.getTickGrowth(0, rewardTokenAddress);

        expect(await virtualPool.nextTick()).to.be.eq(240);
        expect(await virtualPool.prevTick()).to.be.eq(0);

        expect(tickDataAfter).to.be.eq(1); // initial value of totalRewardGrowth0
        expect(tickDataAfter).to.be.eq(1);

        expect(await virtualPool.deactivated()).to.be.false;
      });
    });

    describe('gas checks [ @skip-on-coverage ]', async () => {
      describe('without cross', async () => {
        it('otz', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);

          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

          await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 1);
          await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 1);

          const timestamp = await blockTimestamp();
          await Time.setAndMine(timestamp + 10000);

          await snapshotGasCost(poolMock.crossTo(50, false));
        });

        it('zto', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);

          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

          await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 1);
          await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 1);

          const timestamp = await blockTimestamp();
          await Time.setAndMine(timestamp + 10000);

          await snapshotGasCost(poolMock.crossTo(-50, true));
        });
      });

      describe('with one cross', async () => {
        it('otz', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);

          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

          await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 1);
          await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 1);

          const timestamp = await blockTimestamp();
          await Time.setAndMine(timestamp + 10000);

          await snapshotGasCost(poolMock.crossTo(101, false));
        });

        it('zto', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);

          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

          await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 1);
          await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 1);

          const timestamp = await blockTimestamp();
          await Time.setAndMine(timestamp + 10000);

          await snapshotGasCost(poolMock.crossTo(-101, true));
        });
      });

      describe('with two crosses', async () => {
        it('otz', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);

          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-110, 110, 1000, 1);

          await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 1);
          await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 1);

          const timestamp = await blockTimestamp();
          await Time.setAndMine(timestamp + 10000);

          await snapshotGasCost(poolMock.crossTo(120, false));
        });

        it('zto', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);

          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-110, 110, 1000, 1);

          await virtualPool.connect(pseudoFarming).setRates(rewardTokenAddress, 1);
          await virtualPool.connect(pseudoFarming).addRewards(rewardTokenAddress, 1);

          const timestamp = await blockTimestamp();
          await Time.setAndMine(timestamp + 10000);

          await snapshotGasCost(poolMock.crossTo(-120, true));
        });
      });
    });
  });
});
