import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { MaxUint256 } from 'ethers';
import { expect } from './shared/expect';

import { PoolTicksCounterTest } from '../typechain';

describe('PoolTicksCounter', () => {
  const TICK_SPACINGS = [1];

  TICK_SPACINGS.forEach((TICK_SPACING) => {
    let poolTicksCounter: PoolTicksCounterTest;

    // Bit index to tick
    const bitIdxToTick = (idx: number, page = 0) => {
      return idx * TICK_SPACING + page * 256 * TICK_SPACING;
    };

    const poolTicksCounterFixture = async () => {
      const poolTicksHelperFactory = await ethers.getContractFactory('PoolTicksCounterTest');
      const _poolTicksCounter = (await poolTicksHelperFactory.deploy()) as any as PoolTicksCounterTest;

      await _poolTicksCounter.setTickSpacing(TICK_SPACING);

      return _poolTicksCounter;
    };

    beforeEach(async () => {
      poolTicksCounter = await loadFixture(poolTicksCounterFixture);
    });

    describe(`[Tick Spacing: ${TICK_SPACING}]: tick after is bigger`, async () => {
      it('same tick initialized', async () => {
        await poolTicksCounter.setTickTableWord(0, 0b1100); // 1100
        const result = await poolTicksCounter.countInitializedTicksCrossed(
          poolTicksCounter,
          bitIdxToTick(2),
          bitIdxToTick(2)
        );
        expect(result).to.be.eq(1);
      });

      it('same tick not-initialized', async () => {
        await poolTicksCounter.setTickTableWord(0, 0b1100); // 1100
        const result = await poolTicksCounter.countInitializedTicksCrossed(
          poolTicksCounter,
          bitIdxToTick(1),
          bitIdxToTick(1)
        );
        expect(result).to.be.eq(0);
      });

      it('same page', async () => {
        await poolTicksCounter.setTickTableWord(0, 0b1100); // 1100
        const result = await poolTicksCounter.countInitializedTicksCrossed(
          poolTicksCounter,
          bitIdxToTick(0),
          bitIdxToTick(255)
        );
        expect(result).to.be.eq(2);
      });

      it('multiple pages', async () => {
        await poolTicksCounter.setTickTableWord(0, 0b1100); // 1100
        await poolTicksCounter.setTickTableWord(1, 0b1101); // 1101
        const result = await poolTicksCounter.countInitializedTicksCrossed(
          poolTicksCounter,
          bitIdxToTick(0),
          bitIdxToTick(255, 1)
        );
        expect(result).to.be.eq(5);
      });

      it('counts all ticks in a page except ending tick', async () => {
        await poolTicksCounter.setTickTableWord(0, MaxUint256);
        await poolTicksCounter.setTickTableWord(1, 0x0);
        const result = await poolTicksCounter.countInitializedTicksCrossed(
          poolTicksCounter,
          bitIdxToTick(0),
          bitIdxToTick(255, 1)
        );
        expect(result).to.be.eq(255);
      });

      it('counts ticks to left of start and right of end on same page', async () => {
        await poolTicksCounter.setTickTableWord(0, 0b1111000100001111);
        const result = await poolTicksCounter.countInitializedTicksCrossed(
          poolTicksCounter,
          bitIdxToTick(8),
          bitIdxToTick(255)
        );
        expect(result).to.be.eq(4);
      });

      it('counts ticks to left of start and right of end across on multiple pages', async () => {
        await poolTicksCounter.setTickTableWord(0, 0b1111000100001111);
        await poolTicksCounter.setTickTableWord(1, 0b1111000100001111);
        const result = await poolTicksCounter.countInitializedTicksCrossed(
          poolTicksCounter,
          bitIdxToTick(8),
          bitIdxToTick(8, 1)
        );
        expect(result).to.be.eq(9);
      });

      it('counts ticks when before and after are initialized on same page', async () => {
        await poolTicksCounter.setTickTableWord(0, 0b11111100);
        const startingTickInit = await poolTicksCounter.countInitializedTicksCrossed(
          poolTicksCounter,
          bitIdxToTick(2),
          bitIdxToTick(255)
        );
        expect(startingTickInit).to.be.eq(5);
        const endingTickInit = await poolTicksCounter.countInitializedTicksCrossed(
          poolTicksCounter,
          bitIdxToTick(0),
          bitIdxToTick(3)
        );
        expect(endingTickInit).to.be.eq(2);
        const bothInit = await poolTicksCounter.countInitializedTicksCrossed(
          poolTicksCounter,
          bitIdxToTick(2),
          bitIdxToTick(5)
        );
        expect(bothInit).to.be.eq(3);
      });

      it('counts ticks when before and after are initialized on multiple page', async () => {
        await poolTicksCounter.setTickTableWord(0, 0b11111100);
        await poolTicksCounter.setTickTableWord(1, 0b11111100);
        const startingTickInit = await poolTicksCounter.countInitializedTicksCrossed(
          poolTicksCounter,
          bitIdxToTick(2),
          bitIdxToTick(255)
        );
        expect(startingTickInit).to.be.eq(5);
        const endingTickInit = await poolTicksCounter.countInitializedTicksCrossed(
          poolTicksCounter,
          bitIdxToTick(0),
          bitIdxToTick(3, 1)
        );
        expect(endingTickInit).to.be.eq(8);
        const bothInit = await poolTicksCounter.countInitializedTicksCrossed(
          poolTicksCounter,
          bitIdxToTick(2),
          bitIdxToTick(5, 1)
        );
        expect(bothInit).to.be.eq(9);
      });

      it('counts ticks with lots of pages', async () => {
        await poolTicksCounter.setTickTableWord(0, 0b11111100);
        await poolTicksCounter.setTickTableWord(1, 0b11111111);
        await poolTicksCounter.setTickTableWord(2, 0x0);
        await poolTicksCounter.setTickTableWord(3, 0x0);
        await poolTicksCounter.setTickTableWord(4, 0b11111100);

        const bothInit = await poolTicksCounter.countInitializedTicksCrossed(
          poolTicksCounter,
          bitIdxToTick(4),
          bitIdxToTick(5, 4)
        );
        expect(bothInit).to.be.eq(15);
      });
    });

    describe(`[Tick Spacing: ${TICK_SPACING}]: tick after is smaller`, async () => {
      it('same page', async () => {
        await poolTicksCounter.setTickTableWord(0, 0b1100);
        const result = await poolTicksCounter.countInitializedTicksCrossed(
          poolTicksCounter,
          bitIdxToTick(255),
          bitIdxToTick(0)
        );
        expect(result).to.be.eq(2);
      });

      it('multiple pages', async () => {
        await poolTicksCounter.setTickTableWord(0, 0b1100);
        await poolTicksCounter.setTickTableWord(-1, 0b1100);
        const result = await poolTicksCounter.countInitializedTicksCrossed(
          poolTicksCounter,
          bitIdxToTick(255),
          bitIdxToTick(0, -1)
        );
        expect(result).to.be.eq(4);
      });

      it('counts all ticks in a page', async () => {
        await poolTicksCounter.setTickTableWord(0, MaxUint256);
        await poolTicksCounter.setTickTableWord(-1, 0);
        const result = await poolTicksCounter.countInitializedTicksCrossed(
          poolTicksCounter,
          bitIdxToTick(255),
          bitIdxToTick(0, -1)
        );
        expect(result).to.be.eq(256);
      });

      it('counts ticks to right of start and left of end on same page', async () => {
        await poolTicksCounter.setTickTableWord(0, 0b1111000100001111);
        const result = await poolTicksCounter.countInitializedTicksCrossed(
          poolTicksCounter,
          bitIdxToTick(15),
          bitIdxToTick(2)
        );
        expect(result).to.be.eq(6);
      });

      it('counts ticks to right of start and left of end on multiple pages', async () => {
        await poolTicksCounter.setTickTableWord(0, 0b1111000100001111);
        await poolTicksCounter.setTickTableWord(-1, 0b1111000100001111);
        const result = await poolTicksCounter.countInitializedTicksCrossed(
          poolTicksCounter,
          bitIdxToTick(8),
          bitIdxToTick(8, -1)
        );
        expect(result).to.be.eq(9);
      });

      it('counts ticks when before and after are initialized on same page', async () => {
        await poolTicksCounter.setTickTableWord(0, 0b11111100);
        const startingTickInit = await poolTicksCounter.countInitializedTicksCrossed(
          poolTicksCounter,
          bitIdxToTick(3),
          bitIdxToTick(0)
        );
        expect(startingTickInit).to.be.eq(2);
        const endingTickInit = await poolTicksCounter.countInitializedTicksCrossed(
          poolTicksCounter,
          bitIdxToTick(255),
          bitIdxToTick(2)
        );
        expect(endingTickInit).to.be.eq(5);
        const bothInit = await poolTicksCounter.countInitializedTicksCrossed(
          poolTicksCounter,
          bitIdxToTick(5),
          bitIdxToTick(2)
        );
        expect(bothInit).to.be.eq(3);
      });

      it('counts ticks when before and after are initialized on multiple page', async () => {
        await poolTicksCounter.setTickTableWord(0, 0b11111100);
        await poolTicksCounter.setTickTableWord(-1, 0b11111100);
        const startingTickInit = await poolTicksCounter.countInitializedTicksCrossed(
          poolTicksCounter,
          bitIdxToTick(2),
          bitIdxToTick(3, -1)
        );
        expect(startingTickInit).to.be.eq(5);
        const endingTickInit = await poolTicksCounter.countInitializedTicksCrossed(
          poolTicksCounter,
          bitIdxToTick(5),
          bitIdxToTick(255, -1)
        );
        expect(endingTickInit).to.be.eq(4);
        const bothInit = await poolTicksCounter.countInitializedTicksCrossed(
          poolTicksCounter,
          bitIdxToTick(2),
          bitIdxToTick(5, -1)
        );
        expect(bothInit).to.be.eq(3);
      });

      it('counts ticks with lots of pages', async () => {
        await poolTicksCounter.setTickTableWord(0, 0b11111100);
        await poolTicksCounter.setTickTableWord(-1, 0xff);
        await poolTicksCounter.setTickTableWord(-2, 0x0);
        await poolTicksCounter.setTickTableWord(-3, 0x0);
        await poolTicksCounter.setTickTableWord(-4, 0b11111100);
        const bothInit = await poolTicksCounter.countInitializedTicksCrossed(
          poolTicksCounter,
          bitIdxToTick(3),
          bitIdxToTick(6, -4)
        );
        expect(bothInit).to.be.eq(11);
      });
    });
  });
});
