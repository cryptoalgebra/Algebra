import { ethers } from 'hardhat'
import { TickTableTest } from '../typechain/test/TickTableTest'
import { expect } from './shared/expect'
import snapshotGasCost from './shared/snapshotGasCost'

describe('TickTable', () => {
  let tickTable: TickTableTest

  beforeEach('deploy TickTableTest', async () => {
    const tickTableTestFactory = await ethers.getContractFactory('TickTableTest')
    tickTable = (await tickTableTestFactory.deploy()) as TickTableTest
  })

  async function initTicks(ticks: number[]): Promise<void> {
    for (const tick of ticks) {
      await tickTable.toggleTick(tick)
    }
  }

  describe('#isInitialized', () => {
    it('is false at first', async () => {
      expect(await tickTable.isInitialized(60)).to.eq(false)
    })
    it('is flipped by #toggleTick', async () => {
      await tickTable.toggleTick(60)
      expect(await tickTable.isInitialized(60)).to.eq(true)
    })
    it('is flipped back by #toggleTick', async () => {
      await tickTable.toggleTick(60)
      await tickTable.toggleTick(60)
      expect(await tickTable.isInitialized(60)).to.eq(false)
    })
    it('is not changed by another flip to a different tick', async () => {
      await tickTable.toggleTick(120)
      expect(await tickTable.isInitialized(60)).to.eq(false)
    })
    it('is not changed by another flip to a different tick on another word', async () => {
      await tickTable.toggleTick(60 + 300)
      expect(await tickTable.isInitialized(360)).to.eq(true)
      expect(await tickTable.isInitialized(60)).to.eq(false)
    })
  })

  describe('#toggleTick', () => {
    it('flips only the specified tick', async () => {
      await tickTable.toggleTick(-240)
      expect(await tickTable.isInitialized(-240)).to.eq(true)
      expect(await tickTable.isInitialized(-241)).to.eq(false)
      expect(await tickTable.isInitialized(-300)).to.eq(false)
      expect(await tickTable.isInitialized(-240 + 256)).to.eq(false)
      expect(await tickTable.isInitialized(-240 - 256)).to.eq(false)
      await tickTable.toggleTick(-240)
      expect(await tickTable.isInitialized(-240)).to.eq(false)
      expect(await tickTable.isInitialized(-241)).to.eq(false)
      expect(await tickTable.isInitialized(-180)).to.eq(false)
      expect(await tickTable.isInitialized(-240 + 256)).to.eq(false)
      expect(await tickTable.isInitialized(-240 - 256)).to.eq(false)
    })

    it('reverts only itself', async () => {
      await tickTable.toggleTick(-240)
      await tickTable.toggleTick(-300)
      await tickTable.toggleTick(-180)
      await tickTable.toggleTick(600)
      await tickTable.toggleTick(-240)
      await tickTable.toggleTick(-360)
      await tickTable.toggleTick(-300)

      expect(await tickTable.isInitialized(-180)).to.eq(true)
      expect(await tickTable.isInitialized(-240)).to.eq(false)
    })

    it('gas cost of flipping first tick in word to initialized  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(await tickTable.getGasCostOfFlipTick(60))
    })
    it('gas cost of flipping second tick in word to initialized  [ @skip-on-coverage ]', async () => {
      await tickTable.toggleTick(0)
      await snapshotGasCost(await tickTable.getGasCostOfFlipTick(60))
    })
    it('gas cost of flipping a tick that results in deleting a word  [ @skip-on-coverage ]', async () => {
      await tickTable.toggleTick(0)
      await snapshotGasCost(await tickTable.getGasCostOfFlipTick(0))
    })
  })

  describe('#nextTickInTheSameRow', () => {
    beforeEach('set up some ticks', async () => {
      // word boundaries are at multiples of 256
      await initTicks([-70000,-20000,-10000,-300, -200, -100, 100, 200, 300, 65636, 65646, 150000, 800000])
    })

    it('returns tick to right if at initialized tick', async () => {
      const { next, initialized } = await tickTable.nextTickInTheSameRow(65636, false)
      expect(next).to.eq(65646)
      expect(initialized).to.eq(true)
    })
    it('returns tick to right if at initialized tick', async () => {
      const { next, initialized } = await tickTable.nextTickInTheSameRow(-10000, false)
      expect(next).to.eq(-300)
      expect(initialized).to.eq(true)
    })

    it('returns the tick directly to the right', async () => {
      const { next, initialized } = await tickTable.nextTickInTheSameRow(77*60, false)
      expect(next).to.eq(65636)
      expect(initialized).to.eq(true)
    })
    it('returns the tick directly to the right', async () => {
      const { next, initialized } = await tickTable.nextTickInTheSameRow(200, false)
      expect(next).to.eq(300)
      expect(initialized).to.eq(true)
    })

    it('returns the next words initialized tick if on the right boundary', async () => {
      const { next, initialized } = await tickTable.nextTickInTheSameRow(-200, false)
      expect(next).to.eq(-100)
      expect(initialized).to.eq(true)
    })
    it('returns the next words initialized tick if on the right boundary', async () => {
      const { next, initialized } = await tickTable.nextTickInTheSameRow(100, false)
      expect(next).to.eq(200)
      expect(initialized).to.eq(true)
    })

    it('returns the next initialized tick from the next word', async () => {
      const { next, initialized } = await tickTable.nextTickInTheSameRow(300, false)
      expect(next).to.eq(65636)
      expect(initialized).to.eq(true)
    })
    it('does not exceed boundary', async () => {
      const { next, initialized } = await tickTable.nextTickInTheSameRow(70000, false)
      expect(next).to.eq(150000)
      expect(initialized).to.eq(true)
    })
    it('skips entire word', async () => {
      const { next, initialized } = await tickTable.nextTickInTheSameRow(150000, false)
      expect(next).to.eq(800000)
      expect(initialized).to.eq(true)
    })
    it('skips half word', async () => {
      const { next, initialized } = await tickTable.nextTickInTheSameRow(65636, false)
      expect(next).to.eq(65646)
      expect(initialized).to.eq(true)
    })

    it('skips half word', async () => {
      const { next, initialized } = await tickTable.nextTickInTheSameRow(-70000, false)
      expect(next).to.eq(-20000)
      expect(initialized).to.eq(true)
    })

    it('skips half word', async () => {
      const { next, initialized } = await tickTable.nextTickInTheSameRow(-20000, false)
      expect(next).to.eq(-10000)
      expect(initialized).to.eq(true)
    })

    it('skips half word', async () => {
      const { next, initialized } = await tickTable.nextTickInTheSameRow(-10000, false)
      expect(next).to.eq(-300)
      expect(initialized).to.eq(true)
    })

    it('skips half word', async () => {
      const { next, initialized } = await tickTable.nextTickInTheSameRow(-300, false)
      expect(next).to.eq(-200)
      expect(initialized).to.eq(true)
    })

    it('skips half word', async () => {
      const { next, initialized } = await tickTable.nextTickInTheSameRow(-200, false)
      expect(next).to.eq(-100)
      expect(initialized).to.eq(true)
    })

    it('skips half word', async () => {
      const { next, initialized } = await tickTable.nextTickInTheSameRow(-100, false)
      expect(next).to.eq(100)
      expect(initialized).to.eq(true)
    })

    it('gas cost on boundary  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(await tickTable.getGasCostOfNextTickInTheSameRow(255*60, false))
    })
    it('gas cost just below boundary  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(await tickTable.getGasCostOfNextTickInTheSameRow(254*60, false))
    })
    it('gas cost for entire word  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(await tickTable.getGasCostOfNextTickInTheSameRow(768*60, false))
    })
  })
})
