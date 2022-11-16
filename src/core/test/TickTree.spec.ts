import { ethers } from 'hardhat'
import { TickTreeTest } from '../typechain/test/TickTreeTest'
import { expect } from './shared/expect'
import snapshotGasCost from './shared/snapshotGasCost'

describe('TickTree', () => {
  let TickTree: TickTreeTest

  beforeEach('deploy TickTreeTest', async () => {
    const TickTreeTestFactory = await ethers.getContractFactory('TickTreeTest')
    TickTree = (await TickTreeTestFactory.deploy()) as TickTreeTest
  })

  async function initTicks(ticks: number[]): Promise<void> {
    for (const tick of ticks) {
      await TickTree.toggleTick(tick)
    }
  }

  describe('#isInitialized', () => {
    it('is false at first', async () => {
      expect(await TickTree.isInitialized(60)).to.eq(false)
    })
    it('is flipped by #toggleTick', async () => {
      await TickTree.toggleTick(60)
      expect(await TickTree.isInitialized(60)).to.eq(true)
    })
    it('is flipped back by #toggleTick', async () => {
      await TickTree.toggleTick(60)
      await TickTree.toggleTick(60)
      expect(await TickTree.isInitialized(60)).to.eq(false)
    })
    it('is not changed by another flip to a different tick', async () => {
      await TickTree.toggleTick(120)
      expect(await TickTree.isInitialized(60)).to.eq(false)
    })
    it('is not changed by another flip to a different tick on another word', async () => {
      await TickTree.toggleTick(60 + 300)
      expect(await TickTree.isInitialized(360)).to.eq(true)
      expect(await TickTree.isInitialized(60)).to.eq(false)
    })
  })

  describe('#toggleTick', () => {
    it('flips only the specified tick', async () => {
      await TickTree.toggleTick(-240)
      expect(await TickTree.isInitialized(-240)).to.eq(true)
      expect(await TickTree.isInitialized(-241)).to.eq(false)
      expect(await TickTree.isInitialized(-300)).to.eq(false)
      expect(await TickTree.isInitialized(-240 + 256)).to.eq(false)
      expect(await TickTree.isInitialized(-240 - 256)).to.eq(false)
      await TickTree.toggleTick(-240)
      expect(await TickTree.isInitialized(-240)).to.eq(false)
      expect(await TickTree.isInitialized(-241)).to.eq(false)
      expect(await TickTree.isInitialized(-180)).to.eq(false)
      expect(await TickTree.isInitialized(-240 + 256)).to.eq(false)
      expect(await TickTree.isInitialized(-240 - 256)).to.eq(false)
    })

    it('reverts only itself', async () => {
      await initTicks([-240, -300, -180, 600, -240, -360, -300]);
      expect(await TickTree.isInitialized(-180)).to.eq(true)
      expect(await TickTree.isInitialized(-240)).to.eq(false)
    })

    it('gas cost of flipping first tick in word to initialized  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(await TickTree.getGasCostOfFlipTick(60))
    })
    it('gas cost of flipping second tick in word to initialized  [ @skip-on-coverage ]', async () => {
      await TickTree.toggleTick(0)
      await snapshotGasCost(await TickTree.getGasCostOfFlipTick(60))
    })
    it('gas cost of flipping a tick that results in deleting a word  [ @skip-on-coverage ]', async () => {
      await TickTree.toggleTick(0)
      await snapshotGasCost(await TickTree.getGasCostOfFlipTick(0))
    })
  })

  async function expectNextTickToBe(startTick: number, expectedValue: number, isInit: boolean) {
    const { next, initialized } = await TickTree.nextTickInTheSameNode(startTick)
    expect(next).to.eq(expectedValue)
    expect(initialized).to.eq(isInit)
  }

  describe('#nextTickInTheSameNode special cases', () => {
    it('works across all positive range', async () => {
      await initTicks([887272]);
      await expectNextTickToBe(0, 887272, true);
    })

    it('works for huge gap', async () => {
      await initTicks([882636]);
      await expectNextTickToBe(0, 882636, true);
    })

    it('works across all possible range', async () => {
      await initTicks([887272]);
      await expectNextTickToBe(-887272, 887272, true);
    })

    it('init is far behind', async () => {
      await initTicks([292530]);
      await expectNextTickToBe(357728, 887272, false);
    })

  })
  describe('#nextTickInTheSameNode', () => {
    beforeEach('set up some ticks', async () => {
      // word boundaries are at multiples of 256
      await initTicks([-70000,-20000,-10000,-300, -200, -100, 100, 200, 300, 65636, 65646, 150000, 800000])
    })

    it('returns tick to right if at initialized tick', async () => expectNextTickToBe(65636, 65646, true))

    it('returns tick to right if at initialized tick', async () => expectNextTickToBe(-10000, -300, true))

    it('returns the tick directly to the right', async () => expectNextTickToBe(77*60, 65636, true))

    it('returns the tick directly to the right', async () => await expectNextTickToBe(200, 300, true))

    it('returns the next words initialized tick if on the right boundary', async () => expectNextTickToBe(-200, -100, true))

    it('returns the next words initialized tick if on the right boundary', async () => expectNextTickToBe(100, 200, true))

    it('returns the next initialized tick from the next word', async () => expectNextTickToBe(300, 65636, true))

    it('does not exceed boundary', async () => expectNextTickToBe(70000, 150000, true))

    it('skips entire word', async () => expectNextTickToBe(150000, 800000, true))

    it('skips half word', async () => expectNextTickToBe(65636, 65646, true))

    it('skips half word', async () => expectNextTickToBe(-70000, -20000, true))

    it('skips half word', async () => expectNextTickToBe(-20000, -10000, true))

    it('skips half word', async () => expectNextTickToBe(-10000, -300, true))

    it('skips half word', async () => expectNextTickToBe(-300, -200, true))

    it('skips half word', async () => expectNextTickToBe(-200, -100, true))

    it('skips half word', async () => expectNextTickToBe(-100, 100, true))
  })

  describe('#nextTickInTheSameNode gas  [ @skip-on-coverage ]', () => {
    const FULL_PACK = [-70000,-20000,-10000,-300, -200, -100, 100, 200, 300, 65636, 65646, 150000, 800000];
    it('gas cost on boundary', async () => {
      await initTicks(FULL_PACK)
      await snapshotGasCost(await TickTree.getGasCostOfNextTickInTheSameNode(255*60))
    })
    it('gas cost on boundary', async () => {
      await initTicks(FULL_PACK)
      await snapshotGasCost(await TickTree.getGasCostOfNextTickInTheSameNode(255*60))
    })
    it('gas cost just below boundary', async () => {
      await initTicks(FULL_PACK)
      await snapshotGasCost(await TickTree.getGasCostOfNextTickInTheSameNode(254*60))
    })
    it('gas cost for entire word', async () => {
      await initTicks(FULL_PACK)
      await snapshotGasCost(await TickTree.getGasCostOfNextTickInTheSameNode(768*60))
    })

    it('gas cost for all possible range', async () => {
      await initTicks([887272]);
      await snapshotGasCost(await TickTree.getGasCostOfNextTickInTheSameNode(-887272))
    })

    it('gas cost for next subtree', async () => {
      await initTicks([70000]);
      await snapshotGasCost(await TickTree.getGasCostOfNextTickInTheSameNode(0))
    })
  })
})
