import { ethers } from 'hardhat';
import { MaxUint256 } from 'ethers';
import { TickTest } from '../typechain';
import { expect } from './shared/expect';

describe('Tick', () => {
  let tickTest: TickTest;

  beforeEach('deploy TickTest', async () => {
    const tickTestFactory = await ethers.getContractFactory('TickTest');
    tickTest = (await tickTestFactory.deploy()) as any as TickTest;
  });

  describe('#getInnerFeeGrowth', () => {
    it('returns all for two uninitialized ticks if tick is inside', async () => {
      const { innerFeeGrowth0Token, innerFeeGrowth1Token } = await tickTest.getInnerFeeGrowth(-2, 2, 0, 15, 15);
      expect(innerFeeGrowth0Token).to.eq(15);
      expect(innerFeeGrowth1Token).to.eq(15);
    });
    it('returns 0 for two uninitialized ticks if tick is above', async () => {
      const { innerFeeGrowth0Token, innerFeeGrowth1Token } = await tickTest.getInnerFeeGrowth(-2, 2, 4, 15, 15);
      expect(innerFeeGrowth0Token).to.eq(0);
      expect(innerFeeGrowth1Token).to.eq(0);
    });
    it('returns 0 for two uninitialized ticks if tick is below', async () => {
      const { innerFeeGrowth0Token, innerFeeGrowth1Token } = await tickTest.getInnerFeeGrowth(-2, 2, -4, 15, 15);
      expect(innerFeeGrowth0Token).to.eq(0);
      expect(innerFeeGrowth1Token).to.eq(0);
    });

    it('subtracts upper tick if below', async () => {
      await tickTest.setTick(2, {
        outerFeeGrowth0Token: 2,
        outerFeeGrowth1Token: 3,
        liquidityTotal: 0,
        liquidityDelta: 0,
        prevTick: 0,
        nextTick: 0,
      });
      const { innerFeeGrowth0Token, innerFeeGrowth1Token } = await tickTest.getInnerFeeGrowth(-2, 2, 0, 15, 15);
      expect(innerFeeGrowth0Token).to.eq(13);
      expect(innerFeeGrowth1Token).to.eq(12);
    });

    it('subtracts lower tick if above', async () => {
      await tickTest.setTick(-2, {
        outerFeeGrowth0Token: 2,
        outerFeeGrowth1Token: 3,
        liquidityTotal: 0,
        liquidityDelta: 0,
        prevTick: 0,
        nextTick: 0,
      });
      const { innerFeeGrowth0Token, innerFeeGrowth1Token } = await tickTest.getInnerFeeGrowth(-2, 2, 0, 15, 15);
      expect(innerFeeGrowth0Token).to.eq(13);
      expect(innerFeeGrowth1Token).to.eq(12);
    });

    it('subtracts upper and lower tick if inside', async () => {
      await tickTest.setTick(-2, {
        outerFeeGrowth0Token: 2,
        outerFeeGrowth1Token: 3,
        liquidityTotal: 0,
        liquidityDelta: 0,
        prevTick: 0,
        nextTick: 0,
      });
      await tickTest.setTick(2, {
        outerFeeGrowth0Token: 4,
        outerFeeGrowth1Token: 1,
        liquidityTotal: 0,
        liquidityDelta: 0,
        prevTick: 0,
        nextTick: 0,
      });
      const { innerFeeGrowth0Token, innerFeeGrowth1Token } = await tickTest.getInnerFeeGrowth(-2, 2, 0, 15, 15);
      expect(innerFeeGrowth0Token).to.eq(9);
      expect(innerFeeGrowth1Token).to.eq(11);
    });

    it('works correctly with overflow on inside tick', async () => {
      await tickTest.setTick(-2, {
        outerFeeGrowth0Token: MaxUint256 - 3n,
        outerFeeGrowth1Token: MaxUint256 - 2n,
        liquidityTotal: 0,
        liquidityDelta: 0,
        prevTick: 0,
        nextTick: 0,
      });
      await tickTest.setTick(2, {
        outerFeeGrowth0Token: 3,
        outerFeeGrowth1Token: 5,
        liquidityTotal: 0,
        liquidityDelta: 0,
        prevTick: 0,
        nextTick: 0,
      });
      const { innerFeeGrowth0Token, innerFeeGrowth1Token } = await tickTest.getInnerFeeGrowth(-2, 2, 0, 15, 15);
      expect(innerFeeGrowth0Token).to.eq(16);
      expect(innerFeeGrowth1Token).to.eq(13);
    });
  });

  describe('#update', async () => {
    it('flips from zero to nonzero', async () => {
      expect(await tickTest.update.staticCall(0, 0, 1, 0, 0, false)).to.eq(true);
    });
    it('does not flip from nonzero to greater nonzero', async () => {
      await tickTest.update(0, 0, 1, 0, 0, false);
      expect(await tickTest.update.staticCall(0, 0, 1, 0, 0, false)).to.eq(false);
    });
    it('flips from nonzero to zero', async () => {
      await tickTest.update(0, 0, 1, 0, 0, false);
      expect(await tickTest.update.staticCall(0, 0, -1, 0, 0, false)).to.eq(true);
    });
    it('does not flip from nonzero to lesser nonzero', async () => {
      await tickTest.update(0, 0, 2, 0, 0, false);
      expect(await tickTest.update.staticCall(0, 0, -1, 0, 0, false)).to.eq(false);
    });
    it('reverts if total liquidity gross is greater than max', async () => {
      const maxLiquidityPerTick = await tickTest.maxLiquidityPerTick();
      await tickTest.update(0, 0, maxLiquidityPerTick / 2n, 0, 0, false);
      await tickTest.update(0, 0, maxLiquidityPerTick / 2n, 0, 0, true);
      await expect(
        tickTest.update(0, 0, maxLiquidityPerTick / 2n, 0, 0, false)
      ).to.be.revertedWithCustomError(tickTest, 'liquidityOverflow');
    });
    it('nets the liquidity based on upper flag', async () => {
      await tickTest.update(0, 0, 2, 0, 0, false);
      await tickTest.update(0, 0, 1, 0, 0, true);
      await tickTest.update(0, 0, 3, 0, 0, true);
      await tickTest.update(0, 0, 1, 0, 0, false);
      const { liquidityTotal, liquidityDelta } = await tickTest.ticks(0);
      expect(liquidityTotal).to.eq(2 + 1 + 3 + 1);
      expect(liquidityDelta).to.eq(2 - 1 - 3 + 1);
    });
    it('reverts on overflow liquidity gross', async () => {
      const maxLiquidityPerTick = await tickTest.maxLiquidityPerTick();
      await tickTest.update(0, 0, maxLiquidityPerTick - 1n, 0, 0, false);
      await expect(tickTest.update(0, 0, 2, 0, 0, false)).to.be.reverted;
    });
    it('assumes all growth happens below ticks lte current tick', async () => {
      await tickTest.update(1, 1, 1, 1, 2, false);
      const { outerFeeGrowth0Token, outerFeeGrowth1Token } = await tickTest.ticks(1);
      expect(outerFeeGrowth0Token).to.eq(1);
      expect(outerFeeGrowth1Token).to.eq(2);
    });
    it('does not set any growth fields if tick is already initialized', async () => {
      await tickTest.update(1, 1, 1, 1, 2, false);
      await tickTest.update(1, 1, 1, 6, 7, false);
      const { outerFeeGrowth0Token, outerFeeGrowth1Token } = await tickTest.ticks(1);
      expect(outerFeeGrowth0Token).to.eq(1);
      expect(outerFeeGrowth1Token).to.eq(2);
    });
    it('does not set any growth fields for ticks gt current tick', async () => {
      await tickTest.update(2, 1, 1, 1, 2, false);
      const { outerFeeGrowth0Token, outerFeeGrowth1Token, liquidityDelta } = await tickTest.ticks(2);
      expect(outerFeeGrowth0Token).to.eq(0);
      expect(outerFeeGrowth1Token).to.eq(0);
      expect(liquidityDelta).to.be.eq(1);
    });
  });

  // this is skipped because the presence of the method causes slither to fail
  describe('#clear', async () => {
    it('deletes all the data in the tick', async () => {
      await tickTest.setTick(2, {
        outerFeeGrowth0Token: 1,
        outerFeeGrowth1Token: 2,
        liquidityTotal: 3,
        liquidityDelta: 4,
        prevTick: 0,
        nextTick: 0,
      });
      const before = await tickTest.ticks(2);
      expect(before.outerFeeGrowth0Token).to.eq(1);
      expect(before.outerFeeGrowth1Token).to.eq(2);
      expect(before.liquidityTotal).to.eq(3);
      expect(before.liquidityDelta).to.eq(4);
      await tickTest.clear(2);
      const { outerFeeGrowth0Token, outerFeeGrowth1Token, liquidityTotal, liquidityDelta } = await tickTest.ticks(2);
      expect(outerFeeGrowth0Token).to.eq(0);
      expect(outerFeeGrowth1Token).to.eq(0);
      expect(liquidityTotal).to.eq(0);
      expect(liquidityDelta).to.eq(0);
    });
  });

  describe('#cross', () => {
    it('flips the growth variables', async () => {
      await tickTest.setTick(2, {
        outerFeeGrowth0Token: 1,
        outerFeeGrowth1Token: 2,
        liquidityTotal: 3,
        liquidityDelta: 4,
        prevTick: 0,
        nextTick: 0,
      });
      await tickTest.cross(2, 7, 9);
      const { outerFeeGrowth0Token, outerFeeGrowth1Token } = await tickTest.ticks(2);
      expect(outerFeeGrowth0Token).to.eq(6);
      expect(outerFeeGrowth1Token).to.eq(7);
    });
    it('two flips are no op', async () => {
      await tickTest.setTick(2, {
        outerFeeGrowth0Token: 1,
        outerFeeGrowth1Token: 2,
        liquidityTotal: 3,
        liquidityDelta: 4,
        prevTick: 0,
        nextTick: 0,
      });
      await tickTest.cross(2, 7, 9);
      await tickTest.cross(2, 7, 9);
      const { outerFeeGrowth0Token, outerFeeGrowth1Token } = await tickTest.ticks(2);
      expect(outerFeeGrowth0Token).to.eq(1);
      expect(outerFeeGrowth1Token).to.eq(2);
    });
  });

  describe('#insertTick', () => {
    beforeEach('insert ticks', async () => {
      await tickTest.init();
    });

    it('works correct', async () => {
      await tickTest.insertTick(0, -887272, 887272);
      await tickTest.insertTick(100, 0, 887272);
      await tickTest.insertTick(-100, -887272, 0);
      const { prevTick, nextTick } = await tickTest.ticks(0);
      expect(prevTick).to.eq(-100);
      expect(nextTick).to.eq(100);
    });

    it('insert MAX tick', async () => {
      await tickTest.insertTick(887272, 0, 0);
      const { prevTick, nextTick } = await tickTest.ticks(887272);
      expect(prevTick).to.eq(-887272);
      expect(nextTick).to.eq(887272);
    });

    it('insert MIN tick', async () => {
      await tickTest.insertTick(-887272, 0, 0);
      const { prevTick, nextTick } = await tickTest.ticks(-887272);
      expect(prevTick).to.eq(-887272);
      expect(nextTick).to.eq(887272);
    });

    it('fails with incorrect input', async () => {
      await expect(tickTest.insertTick(0, 887272, -887272)).to.be.revertedWithCustomError(tickTest, 'tickInvalidLinks');
      await expect(tickTest.insertTick(0, -887272, -100)).to.be.revertedWithCustomError(tickTest, 'tickInvalidLinks');
    });
  });

  describe('#removeTick', () => {
    beforeEach('insert ticks', async () => {
      await tickTest.init();
      await tickTest.insertTick(0, -887272, 887272);
      await tickTest.insertTick(100, 0, 887272);
      await tickTest.insertTick(-100, -887272, 0);
    });

    it('works correct', async () => {
      await tickTest.removeTick(0);
      const { prevTick, nextTick } = await tickTest.ticks(0);
      expect(prevTick).to.eq(0);
      expect(nextTick).to.eq(0);
    });

    it('remove MIN tick', async () => {
      await tickTest.removeTick(-887272);
      const { prevTick, nextTick } = await tickTest.ticks(-887272);
      expect(prevTick).to.eq(-887272);
      expect(nextTick).to.eq(-100);
    });

    it('remove MAX tick', async () => {
      await tickTest.removeTick(887272);
      const { prevTick, nextTick } = await tickTest.ticks(887272);
      expect(prevTick).to.eq(100);
      expect(nextTick).to.eq(887272);
    });

    it('fails when remove not initialized tick', async () => {
      await expect(tickTest.removeTick(1)).to.be.revertedWithCustomError(tickTest, 'tickIsNotInitialized');
    });
  });
});
