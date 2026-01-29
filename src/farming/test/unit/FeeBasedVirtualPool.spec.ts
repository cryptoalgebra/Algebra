import { ethers } from 'hardhat';
import { Wallet } from 'ethers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect, blockTimestamp, snapshotGasCost } from '../shared';

import { createTimeMachine } from '../shared/time';

import { PoolMock, TestVirtualPool } from '../../typechain';

const MIN_TICK = -887272;
const MAX_TICK = 887272;

// Default sqrtPrice for testing (corresponds to price = 1)
const DEFAULT_SQRT_PRICE = 79228162514264337593543950336n; // 2^96

describe('unit/FeeBasedVirtualPool', () => {
  let pseudoFarming: Wallet;

  const Time = createTimeMachine();

  let poolMock: PoolMock;
  let virtualPool: TestVirtualPool;

  let initTimestamp: number;

  before(async () => {
    const wallets = (await ethers.getSigners()) as any as Wallet[];
    pseudoFarming = wallets[1];
  });

  const virtualPoolFixture: () => Promise<{ poolMock: PoolMock; virtualPool: TestVirtualPool; initTimestamp: number }> = async () => {
    const _blockTimestamp = await blockTimestamp();
    const _initTimestamp = _blockTimestamp + 1000000;

    const poolMockFactory = await ethers.getContractFactory('PoolMock');
    const _poolMock = (await poolMockFactory.deploy()) as any as PoolMock;

    await Time.set(_initTimestamp);

    const virtualPoolFactory = await ethers.getContractFactory('TestVirtualPool');
    const _virtualPool = (await virtualPoolFactory.deploy(pseudoFarming.address, _poolMock)) as any as TestVirtualPool;

    return {
      poolMock: _poolMock,
      virtualPool: _virtualPool,
      initTimestamp: _initTimestamp,
    };
  };

  beforeEach('load fixture', async () => {
    ({ poolMock, virtualPool, initTimestamp } = await loadFixture(virtualPoolFixture));
  });

  it('cannot call onlyFarming methods as not farming', async () => {
    await expect(virtualPool.applyLiquidityDeltaToPosition(100, 110, 100, 100)).to.be.revertedWithCustomError(virtualPool, 'onlyFarming');
    await expect(virtualPool.deactivate()).to.be.revertedWithCustomError(virtualPool, 'onlyFarming');
  });

  it('cannot call onlyPlugin methods as not plugin', async () => {
    await expect(virtualPool.afterCross(true, 1000, 0, DEFAULT_SQRT_PRICE, 1000)).to.be.revertedWithCustomError(virtualPool, 'onlyPlugin');
    await expect(virtualPool.afterSwap(true, 1000, 0, DEFAULT_SQRT_PRICE, 1000)).to.be.revertedWithCustomError(virtualPool, 'onlyPlugin');
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

    // Fee-based: totalFeeGrowth and totalFees start at 1
    const totalFeeGrowth = await virtualPool.totalFeeGrowth();
    expect(totalFeeGrowth).to.be.eq(1);

    const totalFees = await virtualPool.totalFees();
    expect(totalFees).to.be.eq(1);
  });

  describe('#applyLiquidityDeltaToPosition', async () => {
    it('increases liquidity if in-range', async () => {
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

      const liquidity = await virtualPool.currentLiquidity();
      expect(liquidity).to.be.eq(1000);
    });

    it('can add liquidity to existing in-range position', async () => {
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 100, 1);

      const liquidity = await virtualPool.currentLiquidity();
      expect(liquidity).to.be.eq(1100);
    });

    it('does not increase liquidity if out-of-range', async () => {
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, -101);

      const liquidity = await virtualPool.currentLiquidity();
      expect(liquidity).to.be.eq(0);
    });

    it('can create overlapping positions', async () => {
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(100, 200, 1000, 1);

      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-200, -100, 1000, 1);

      const liquidity = await virtualPool.currentLiquidity();
      expect(liquidity).to.be.eq(1000);
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

  describe('#getInnerFeeGrowth', async () => {
    it('reverts if ticks are invalid', async () => {
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-200, 100, 1000, 1);

      await expect(virtualPool.getInnerFeeGrowth(-220, 220)).to.be.revertedWithCustomError(virtualPool, 'tickIsNotInitialized');
      await expect(virtualPool.getInnerFeeGrowth(-220, -200)).to.be.revertedWithCustomError(virtualPool, 'tickIsNotInitialized');
      await expect(virtualPool.getInnerFeeGrowth(100, 120)).to.be.revertedWithCustomError(virtualPool, 'tickIsNotInitialized');
    });

    it('returns 0 if no fees accrued', async () => {
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

      const innerFeeGrowth = await virtualPool.getInnerFeeGrowth(-100, 100);
      expect(innerFeeGrowth).to.be.eq(0);
    });

    it('returns fee growth after swap', async () => {
      await poolMock.setPlugin(poolMock);
      await poolMock.setVirtualPool(virtualPool);
      
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

      // Simulate swap with fee
      await poolMock.afterSwap(true, 1000n, 1, DEFAULT_SQRT_PRICE, 1000n);

      const innerFeeGrowth = await virtualPool.getInnerFeeGrowth(-100, 100);
      expect(innerFeeGrowth).to.be.gt(0);
    });

    it('returns 0 for out-of-range position even with fees', async () => {
      await poolMock.setPlugin(poolMock);
      await poolMock.setVirtualPool(virtualPool);
      
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(200, 300, 1000, 1);

      // Simulate swap with fee
      await poolMock.afterSwap(true, 1000n, 1, DEFAULT_SQRT_PRICE, 1000n);

      const innerFeeGrowthInRange = await virtualPool.getInnerFeeGrowth(-100, 100);
      expect(innerFeeGrowthInRange).to.be.gt(0);

      const innerFeeGrowthOutOfRange = await virtualPool.getInnerFeeGrowth(200, 300);
      expect(innerFeeGrowthOutOfRange).to.be.eq(0);
    });
  });

  describe('#afterSwap', async () => {
    it('reverts if not from plugin', async () => {
      await expect(virtualPool.afterSwap(true, 1000n, 0, DEFAULT_SQRT_PRICE, 1000n)).to.be.revertedWithCustomError(virtualPool, 'onlyPlugin');
    });

    it('does nothing if deactivated', async () => {
      await poolMock.setPlugin(poolMock);
      await poolMock.setVirtualPool(virtualPool);
      
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);
      await virtualPool.connect(pseudoFarming).deactivate();

      const feeGrowthBefore = await virtualPool.totalFeeGrowth();
      await poolMock.afterSwap(true, 1000n, 10, DEFAULT_SQRT_PRICE, 1000n);
      const feeGrowthAfter = await virtualPool.totalFeeGrowth();

      expect(feeGrowthAfter).to.be.eq(feeGrowthBefore);
    });

    it('does not update fee growth if zero liquidity', async () => {
      await poolMock.setPlugin(poolMock);
      await poolMock.setVirtualPool(virtualPool);
      
      // Position out of range, so currentLiquidity = 0
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 101);

      const feeGrowthBefore = await virtualPool.totalFeeGrowth();
      await poolMock.afterSwap(true, 1000n, 101, DEFAULT_SQRT_PRICE, 1000n);
      const feeGrowthAfter = await virtualPool.totalFeeGrowth();

      expect(feeGrowthAfter).to.be.eq(feeGrowthBefore);
    });

    it('updates fee growth proportional to liquidity', async () => {
      await poolMock.setPlugin(poolMock);
      await poolMock.setVirtualPool(virtualPool);
      
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

      const feeGrowthBefore = await virtualPool.totalFeeGrowth();
      // Pool liquidity = 2000, virtual pool liquidity = 1000, so farming gets 50% of fees
      await poolMock.afterSwap(true, 2000n, 1, DEFAULT_SQRT_PRICE, 2000n);
      const feeGrowthAfter = await virtualPool.totalFeeGrowth();

      expect(feeGrowthAfter).to.be.gt(feeGrowthBefore);
    });

    it('updates global tick', async () => {
      await poolMock.setPlugin(poolMock);
      await poolMock.setVirtualPool(virtualPool);
      
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

      expect(await virtualPool.globalTick()).to.be.eq(1);
      await poolMock.afterSwap(true, 0, 50, DEFAULT_SQRT_PRICE, 1000n);
      expect(await virtualPool.globalTick()).to.be.eq(50);
    });

    it('converts token1 fees to token0 equivalent', async () => {
      await poolMock.setPlugin(poolMock);
      await poolMock.setVirtualPool(virtualPool);
      
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

      const feeGrowthBefore = await virtualPool.totalFeeGrowth();
      // oneToZero swap - fee is in token1, will be converted to token0
      await poolMock.afterSwap(false, 1000n, 1, DEFAULT_SQRT_PRICE, 1000n);
      const feeGrowthAfter = await virtualPool.totalFeeGrowth();

      expect(feeGrowthAfter).to.be.gt(feeGrowthBefore);
    });
  });

  describe('#afterCross', async () => {
    it('reverts if not from plugin', async () => {
      await expect(virtualPool.afterCross(true, 1000n, 0, DEFAULT_SQRT_PRICE, 1000n)).to.be.revertedWithCustomError(virtualPool, 'onlyPlugin');
    });

    describe('oneToZero (otz)', async () => {
      it('without cross - does not change liquidity', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

        // Call afterCross with tick that doesn't require crossing
        await poolMock.afterCross(false, 100n, 50, DEFAULT_SQRT_PRICE, 1000n);

        const globalTick = await virtualPool.globalTick();
        expect(globalTick).to.be.eq(1); // unchanged since tick 50 is not initialized

        expect(await virtualPool.deactivated()).to.be.false;
        expect(await virtualPool.currentLiquidity()).to.be.eq(1000);
      });

      it('can cross one tick otz', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

        // Cross tick 100 (going up)
        await poolMock.afterCross(false, 100n, 100, DEFAULT_SQRT_PRICE, 1000n);
        
        const globalTick = await virtualPool.globalTick();
        expect(globalTick).to.be.eq(100);

        // Liquidity should decrease since we exit the position range
        expect(await virtualPool.currentLiquidity()).to.be.eq(0);
        expect(await virtualPool.nextTick()).to.be.eq(MAX_TICK);
        expect(await virtualPool.prevTick()).to.be.eq(100);
      });

      it('updates fee growth on cross', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

        const feeGrowthBefore = await virtualPool.totalFeeGrowth();
        await poolMock.afterCross(false, 1000n, 100, DEFAULT_SQRT_PRICE, 1000n);
        const feeGrowthAfter = await virtualPool.totalFeeGrowth();

        expect(feeGrowthAfter).to.be.gt(feeGrowthBefore);
      });

      it('can cross two ticks otz', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);
        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-110, 110, 1000, 1);

        // First cross at tick 100
        await poolMock.afterCross(false, 100n, 100, DEFAULT_SQRT_PRICE, 2000n);
        expect(await virtualPool.currentLiquidity()).to.be.eq(1000);
        
        // Second cross at tick 110
        await poolMock.afterCross(false, 100n, 110, DEFAULT_SQRT_PRICE, 1000n);
        expect(await virtualPool.currentLiquidity()).to.be.eq(0);
        expect(await virtualPool.nextTick()).to.be.eq(MAX_TICK);
        expect(await virtualPool.prevTick()).to.be.eq(110);
      });

      it('deactivates if invalid direction', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

        expect(await virtualPool.deactivated()).to.be.false;
        // Trying to cross tick -101 with otz direction (should go up, but tick is below current)
        await poolMock.afterCross(false, 100n, -101, DEFAULT_SQRT_PRICE, 1000n);
        
        expect(await virtualPool.deactivated()).to.be.true;
      });

      it('returns early if deactivated', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);
        await virtualPool.connect(pseudoFarming).deactivate();

        const globalTickBefore = await virtualPool.globalTick();
        await poolMock.afterCross(false, 100n, 100, DEFAULT_SQRT_PRICE, 1000n);
        const globalTickAfter = await virtualPool.globalTick();

        expect(globalTickAfter).to.be.eq(globalTickBefore);
        expect(await virtualPool.deactivated()).to.be.true;
      });
    });

    describe('zeroToOne (zto)', async () => {
      it('without cross - does not change liquidity', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

        // Call afterCross with tick that doesn't require crossing
        await poolMock.afterCross(true, 100n, -50, DEFAULT_SQRT_PRICE, 1000n);

        const globalTick = await virtualPool.globalTick();
        expect(globalTick).to.be.eq(1); // unchanged since tick -50 is not initialized

        expect(await virtualPool.deactivated()).to.be.false;
        expect(await virtualPool.currentLiquidity()).to.be.eq(1000);
      });

      it('can cross one tick zto', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

        // Cross tick -100 (going down)
        await poolMock.afterCross(true, 100n, -100, DEFAULT_SQRT_PRICE, 1000n);
        
        const globalTick = await virtualPool.globalTick();
        expect(globalTick).to.be.eq(-100);

        // Liquidity should decrease since we exit the position range
        expect(await virtualPool.currentLiquidity()).to.be.eq(0);
        expect(await virtualPool.nextTick()).to.be.eq(-100);
        expect(await virtualPool.prevTick()).to.be.eq(MIN_TICK);
      });

      it('can cross two ticks zto', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);
        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-110, 110, 1000, 1);

        // First cross at tick -100
        await poolMock.afterCross(true, 100n, -100, DEFAULT_SQRT_PRICE, 2000n);
        expect(await virtualPool.currentLiquidity()).to.be.eq(1000);
        
        // Second cross at tick -110
        await poolMock.afterCross(true, 100n, -110, DEFAULT_SQRT_PRICE, 1000n);
        expect(await virtualPool.currentLiquidity()).to.be.eq(0);
        expect(await virtualPool.nextTick()).to.be.eq(-110);
        expect(await virtualPool.prevTick()).to.be.eq(MIN_TICK);
      });

      it('deactivates if invalid direction', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

        expect(await virtualPool.deactivated()).to.be.false;
        // Trying to cross tick 100 with zto direction (should go down, but tick is above current)
        await poolMock.afterCross(true, 100n, 100, DEFAULT_SQRT_PRICE, 1000n);
        
        expect(await virtualPool.deactivated()).to.be.true;
      });

      it('returns early if deactivated', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);
        await virtualPool.connect(pseudoFarming).deactivate();

        const globalTickBefore = await virtualPool.globalTick();
        await poolMock.afterCross(true, 100n, -100, DEFAULT_SQRT_PRICE, 1000n);
        const globalTickAfter = await virtualPool.globalTick();

        expect(globalTickAfter).to.be.eq(globalTickBefore);
        expect(await virtualPool.deactivated()).to.be.true;
      });
    });

    describe('tick crossing from both directions', async () => {
      it('crosses tick twice - zto then otz', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-600, 240, 1000, -1);
        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(0, 240, 1000, -1);

        // Cross tick 0 going down (zto)
        await poolMock.afterCross(true, 100n, 0, DEFAULT_SQRT_PRICE, 2000n);

        expect(await virtualPool.globalTick()).to.be.eq(0);
        expect(await virtualPool.currentLiquidity()).to.be.eq(1000); // only -600 to 240 position is active

        const tickData = await virtualPool.ticks(0);
        expect(tickData.outerFeeGrowth0Token).to.be.gt(0);

        expect(await virtualPool.nextTick()).to.be.eq(0);
        expect(await virtualPool.prevTick()).to.be.eq(-600);

        // Cross tick 0 going up (otz)
        await poolMock.afterCross(false, 100n, 0, DEFAULT_SQRT_PRICE, 1000n);

        expect(await virtualPool.globalTick()).to.be.eq(0);
        expect(await virtualPool.currentLiquidity()).to.be.eq(2000); // both positions active again

        const tickDataAfter = await virtualPool.ticks(0);
        // Outer fee growth should be reset after crossing back
        expect(tickDataAfter.outerFeeGrowth0Token).to.be.eq(0);

        expect(await virtualPool.nextTick()).to.be.eq(240);
        expect(await virtualPool.prevTick()).to.be.eq(0);

        expect(await virtualPool.deactivated()).to.be.false;
      });

      it('crosses tick twice - otz then zto', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);

        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-600, 240, 1000, 1);
        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(0, 240, 1000, 1);

        // Cross tick 240 going up (otz)
        await poolMock.afterCross(false, 100n, 240, DEFAULT_SQRT_PRICE, 2000n);

        expect(await virtualPool.globalTick()).to.be.eq(240);
        expect(await virtualPool.currentLiquidity()).to.be.eq(0); // no positions active above 240

        expect(await virtualPool.nextTick()).to.be.eq(MAX_TICK);
        expect(await virtualPool.prevTick()).to.be.eq(240);

        // Cross tick 240 going down (zto)
        await poolMock.afterCross(true, 100n, 240, DEFAULT_SQRT_PRICE, 0);

        expect(await virtualPool.globalTick()).to.be.eq(240);
        expect(await virtualPool.currentLiquidity()).to.be.eq(2000); // both positions active again

        expect(await virtualPool.deactivated()).to.be.false;
      });
    });
  });

  describe('#fee accumulation', async () => {
    it('accumulates fees correctly over multiple swaps', async () => {
      await poolMock.setPlugin(poolMock);
      await poolMock.setVirtualPool(virtualPool);
      
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

      const initialTotalFees = await virtualPool.totalFees();
      
      // Multiple swaps
      await poolMock.afterSwap(true, 1000n, 1, DEFAULT_SQRT_PRICE, 1000n);
      await poolMock.afterSwap(true, 500n, 1, DEFAULT_SQRT_PRICE, 1000n);
      await poolMock.afterSwap(false, 750n, 1, DEFAULT_SQRT_PRICE, 1000n);

      const finalTotalFees = await virtualPool.totalFees();
      expect(finalTotalFees).to.be.gt(initialTotalFees);
    });

    it('distributes fees proportionally to liquidity share', async () => {
      await poolMock.setPlugin(poolMock);
      await poolMock.setVirtualPool(virtualPool);
      
      // Virtual pool has 500 liquidity, pool has 1000
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 500, 1);

      const feeAmount = 1000n;
      const poolLiquidity = 1000n;
      
      await poolMock.afterSwap(true, feeAmount, 1, DEFAULT_SQRT_PRICE, poolLiquidity);

      // Only 50% of fee should go to farming (500/1000)
      const totalFees = await virtualPool.totalFees();
      expect(totalFees).to.be.gt(1); // Initial value is 1
    });

    it('position gets correct share of accumulated fees', async () => {
      await poolMock.setPlugin(poolMock);
      await poolMock.setVirtualPool(virtualPool);
      
      // Two positions with equal liquidity
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 500, 1);
      await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-50, 50, 500, 1);

      await poolMock.afterSwap(true, 2000n, 1, DEFAULT_SQRT_PRICE, 1000n);

      // Both positions should have equal inner fee growth
      const innerFeeGrowth1 = await virtualPool.getInnerFeeGrowth(-100, 100);
      const innerFeeGrowth2 = await virtualPool.getInnerFeeGrowth(-50, 50);

      expect(innerFeeGrowth1).to.be.gt(0);
      expect(innerFeeGrowth2).to.be.gt(0);
      // The narrower position should have same fee growth since both cover tick 1
      expect(innerFeeGrowth1).to.be.eq(innerFeeGrowth2);
    });
  });

  describe('#deactivate', async () => {
    it('can only be called by farming', async () => {
      await expect(virtualPool.deactivate()).to.be.revertedWithCustomError(virtualPool, 'onlyFarming');
    });

    it('sets deactivated flag', async () => {
      expect(await virtualPool.deactivated()).to.be.false;
      await virtualPool.connect(pseudoFarming).deactivate();
      expect(await virtualPool.deactivated()).to.be.true;
    });
  });

  describe('gas checks [ @skip-on-coverage ]', async () => {
    describe('#applyLiquidityDeltaToPosition', async () => {
      it('first position - initializes ticks', async () => {
        await snapshotGasCost(virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1));
      });

      it('second position - same range', async () => {
        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);
        await snapshotGasCost(virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 500, 1));
      });

      it('second position - overlapping range', async () => {
        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);
        await snapshotGasCost(virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-50, 50, 500, 1));
      });

      it('position out of range', async () => {
        await snapshotGasCost(virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 101));
      });

      it('remove position - clears ticks', async () => {
        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);
        await snapshotGasCost(virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, -1000, 1));
      });

      it('full range position', async () => {
        await snapshotGasCost(virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(MIN_TICK, MAX_TICK, 1000, 1));
      });
    });

    describe('#afterSwap', async () => {
      describe('zeroToOne', async () => {
        it('with fee accumulation - first swap', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

          await snapshotGasCost(poolMock.afterSwap(true, 1000n, 1, DEFAULT_SQRT_PRICE, 1000n));
        });

        it('with fee accumulation - subsequent swap', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);
          await poolMock.afterSwap(true, 1000n, 1, DEFAULT_SQRT_PRICE, 1000n);

          await snapshotGasCost(poolMock.afterSwap(true, 500n, 1, DEFAULT_SQRT_PRICE, 1000n));
        });

        it('with partial liquidity share (50%)', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 500, 1);

          await snapshotGasCost(poolMock.afterSwap(true, 1000n, 1, DEFAULT_SQRT_PRICE, 1000n));
        });

        it('with zero fee amount', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

          await snapshotGasCost(poolMock.afterSwap(true, 0n, 1, DEFAULT_SQRT_PRICE, 1000n));
        });
      });

      describe('oneToZero', async () => {
        it('with fee accumulation and price conversion', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

          await snapshotGasCost(poolMock.afterSwap(false, 1000n, 1, DEFAULT_SQRT_PRICE, 1000n));
        });

        it('with different sqrt price', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);
          // sqrtPrice = 2^96 * sqrt(2) ≈ 1.41 price
          const sqrtPrice2 = 112045541949572287496682733568n;

          await snapshotGasCost(poolMock.afterSwap(false, 1000n, 1, sqrtPrice2, 1000n));
        });
      });

      describe('edge cases', async () => {
        it('without liquidity in virtual pool', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);

          await snapshotGasCost(poolMock.afterSwap(true, 1000n, 1, DEFAULT_SQRT_PRICE, 1000n));
        });

        it('with position out of range', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 101);

          await snapshotGasCost(poolMock.afterSwap(true, 1000n, 101, DEFAULT_SQRT_PRICE, 1000n));
        });

        it('when deactivated', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);
          await virtualPool.connect(pseudoFarming).deactivate();

          await snapshotGasCost(poolMock.afterSwap(true, 1000n, 1, DEFAULT_SQRT_PRICE, 1000n));
        });

        it('with large fee amount', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

          await snapshotGasCost(poolMock.afterSwap(true, 10n ** 18n, 1, DEFAULT_SQRT_PRICE, 1000n));
        });
      });
    });

    describe('#afterCross', async () => {
      describe('without tick initialization', async () => {
        it('otz - tick not initialized', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

          await snapshotGasCost(poolMock.afterCross(false, 100n, 50, DEFAULT_SQRT_PRICE, 1000n));
        });

        it('zto - tick not initialized', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

          await snapshotGasCost(poolMock.afterCross(true, 100n, -50, DEFAULT_SQRT_PRICE, 1000n));
        });
      });

      describe('with one tick cross', async () => {
        it('otz - cross upper tick', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

          await snapshotGasCost(poolMock.afterCross(false, 100n, 100, DEFAULT_SQRT_PRICE, 1000n));
        });

        it('zto - cross lower tick', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

          await snapshotGasCost(poolMock.afterCross(true, 100n, -100, DEFAULT_SQRT_PRICE, 1000n));
        });

        it('otz - with fee accumulation', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

          await snapshotGasCost(poolMock.afterCross(false, 10000n, 100, DEFAULT_SQRT_PRICE, 1000n));
        });

        it('zto - with fee accumulation', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);

          await snapshotGasCost(poolMock.afterCross(true, 10000n, -100, DEFAULT_SQRT_PRICE, 1000n));
        });
      });

      describe('with two tick crosses', async () => {
        it('otz - first cross', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-110, 110, 1000, 1);

          await snapshotGasCost(poolMock.afterCross(false, 100n, 100, DEFAULT_SQRT_PRICE, 2000n));
        });

        it('otz - second cross', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-110, 110, 1000, 1);
          await poolMock.afterCross(false, 100n, 100, DEFAULT_SQRT_PRICE, 2000n);

          await snapshotGasCost(poolMock.afterCross(false, 100n, 110, DEFAULT_SQRT_PRICE, 1000n));
        });

        it('zto - first cross', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-110, 110, 1000, 1);

          await snapshotGasCost(poolMock.afterCross(true, 100n, -100, DEFAULT_SQRT_PRICE, 2000n));
        });

        it('zto - second cross', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-110, 110, 1000, 1);
          await poolMock.afterCross(true, 100n, -100, DEFAULT_SQRT_PRICE, 2000n);

          await snapshotGasCost(poolMock.afterCross(true, 100n, -110, DEFAULT_SQRT_PRICE, 1000n));
        });
      });

      describe('with three or more tick crosses', async () => {
        it('otz - third cross', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-110, 110, 1000, 1);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-120, 120, 1000, 1);
          await poolMock.afterCross(false, 100n, 100, DEFAULT_SQRT_PRICE, 3000n);
          await poolMock.afterCross(false, 100n, 110, DEFAULT_SQRT_PRICE, 2000n);

          await snapshotGasCost(poolMock.afterCross(false, 100n, 120, DEFAULT_SQRT_PRICE, 1000n));
        });

        it('zto - third cross', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-110, 110, 1000, 1);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-120, 120, 1000, 1);
          await poolMock.afterCross(true, 100n, -100, DEFAULT_SQRT_PRICE, 3000n);
          await poolMock.afterCross(true, 100n, -110, DEFAULT_SQRT_PRICE, 2000n);

          await snapshotGasCost(poolMock.afterCross(true, 100n, -120, DEFAULT_SQRT_PRICE, 1000n));
        });
      });

      describe('direction changes', async () => {
        it('otz then zto - same tick', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-600, 240, 1000, 1);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(0, 240, 1000, 1);
          await poolMock.afterCross(false, 100n, 240, DEFAULT_SQRT_PRICE, 2000n);

          await snapshotGasCost(poolMock.afterCross(true, 100n, 240, DEFAULT_SQRT_PRICE, 0));
        });

        it('zto then otz - same tick', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-600, 240, 1000, -1);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(0, 240, 1000, -1);
          await poolMock.afterCross(true, 100n, 0, DEFAULT_SQRT_PRICE, 2000n);

          await snapshotGasCost(poolMock.afterCross(false, 100n, 0, DEFAULT_SQRT_PRICE, 1000n));
        });
      });

      describe('edge cases', async () => {
        it('when deactivated', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);
          await virtualPool.connect(pseudoFarming).deactivate();

          await snapshotGasCost(poolMock.afterCross(false, 100n, 100, DEFAULT_SQRT_PRICE, 1000n));
        });

        it('with zero liquidity', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);

          await snapshotGasCost(poolMock.afterCross(false, 100n, 100, DEFAULT_SQRT_PRICE, 1000n));
        });

        it('crossing to MAX_TICK - 1', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(MIN_TICK + 1, MAX_TICK - 1, 1000, 1);
          await poolMock.afterCross(false, 100n, 100, DEFAULT_SQRT_PRICE, 2000n);

          await snapshotGasCost(poolMock.afterCross(false, 100n, MAX_TICK - 1, DEFAULT_SQRT_PRICE, 1000n));
        });

        it('crossing from MIN_TICK + 1', async () => {
          await poolMock.setPlugin(poolMock);
          await poolMock.setVirtualPool(virtualPool);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);
          await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(MIN_TICK + 1, MAX_TICK - 1, 1000, 1);
          await poolMock.afterCross(true, 100n, -100, DEFAULT_SQRT_PRICE, 2000n);

          await snapshotGasCost(poolMock.afterCross(true, 100n, MIN_TICK + 1, DEFAULT_SQRT_PRICE, 1000n));
        });
      });
    });

    describe('#getInnerFeeGrowth', async () => {
      it('simple position', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);
        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);
        await poolMock.afterSwap(true, 1000n, 1, DEFAULT_SQRT_PRICE, 1000n);

        await snapshotGasCost(virtualPool.getInnerFeeGrowth(-100, 100));
      });

      it('after multiple swaps', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);
        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);
        await poolMock.afterSwap(true, 1000n, 1, DEFAULT_SQRT_PRICE, 1000n);
        await poolMock.afterSwap(false, 500n, 1, DEFAULT_SQRT_PRICE, 1000n);
        await poolMock.afterSwap(true, 750n, 1, DEFAULT_SQRT_PRICE, 1000n);

        await snapshotGasCost(virtualPool.getInnerFeeGrowth(-100, 100));
      });

      it('full range position', async () => {
        await poolMock.setPlugin(poolMock);
        await poolMock.setVirtualPool(virtualPool);
        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(MIN_TICK, MAX_TICK, 1000, 1);
        await poolMock.afterSwap(true, 1000n, 1, DEFAULT_SQRT_PRICE, 1000n);

        await snapshotGasCost(virtualPool.getInnerFeeGrowth(MIN_TICK, MAX_TICK));
      });
    });

    describe('#deactivate', async () => {
      it('deactivate virtual pool', async () => {
        await virtualPool.connect(pseudoFarming).applyLiquidityDeltaToPosition(-100, 100, 1000, 1);
        await snapshotGasCost(virtualPool.connect(pseudoFarming).deactivate());
      });
    });
  });
});
