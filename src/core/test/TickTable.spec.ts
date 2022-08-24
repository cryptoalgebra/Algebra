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
      await initTicks([-200*60, -55*60, -4*60, 70*60, 78*60, 84*60, 139*60, 240*60, 535*60])
    })

    describe('lte = false', async () => {
      it('returns tick to right if at initialized tick', async () => {
        const { next, initialized } = await tickTable.nextTickInTheSameRow(78*60, false)
        expect(next).to.eq(84*60)
        expect(initialized).to.eq(true)
      })
      it('returns tick to right if at initialized tick', async () => {
        const { next, initialized } = await tickTable.nextTickInTheSameRow(-55*60, false)
        expect(next).to.eq(-4*60)
        expect(initialized).to.eq(true)
      })

      it('returns the tick directly to the right', async () => {
        const { next, initialized } = await tickTable.nextTickInTheSameRow(77*60, false)
        expect(next).to.eq(78*60)
        expect(initialized).to.eq(true)
      })
      it('returns the tick directly to the right', async () => {
        const { next, initialized } = await tickTable.nextTickInTheSameRow(-56*60, false)
        expect(next).to.eq(-55*60)
        expect(initialized).to.eq(true)
      })

      it('returns the next words initialized tick if on the right boundary', async () => {
        const { next, initialized } = await tickTable.nextTickInTheSameRow(255*60, false)
        expect(next).to.eq(511*60)
        expect(initialized).to.eq(false)
      })
      it('returns the next words initialized tick if on the right boundary', async () => {
        const { next, initialized } = await tickTable.nextTickInTheSameRow(-257*60, false)
        expect(next).to.eq(-200*60)
        expect(initialized).to.eq(true)
      })

      it('returns the next initialized tick from the next word', async () => {
        await tickTable.toggleTick(340*60)
        const { next, initialized } = await tickTable.nextTickInTheSameRow(328*60, false)
        expect(next).to.eq(340*60)
        expect(initialized).to.eq(true)
      })
      it('does not exceed boundary', async () => {
        const { next, initialized } = await tickTable.nextTickInTheSameRow(508*60, false)
        expect(next).to.eq(511*60)
        expect(initialized).to.eq(false)
      })
      it('skips entire word', async () => {
        const { next, initialized } = await tickTable.nextTickInTheSameRow(255*60, false)
        expect(next).to.eq(511*60)
        expect(initialized).to.eq(false)
      })
      it('skips half word', async () => {
        const { next, initialized } = await tickTable.nextTickInTheSameRow(383*60, false)
        expect(next).to.eq(511*60)
        expect(initialized).to.eq(false)
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

    describe('lte = true', () => {
      it('returns same tick if initialized', async () => {
        const { next, initialized } = await tickTable.nextTickInTheSameRow(78*60, true)

        expect(next).to.eq(78*60)
        expect(initialized).to.eq(true)
      })
      it('returns tick directly to the left of input tick if not initialized', async () => {
        const { next, initialized } = await tickTable.nextTickInTheSameRow(79*60, true)

        expect(next).to.eq(78*60)
        expect(initialized).to.eq(true)
      })
      it('will not exceed the word boundary', async () => {
        const { next, initialized } = await tickTable.nextTickInTheSameRow(258*60, true)

        expect(next).to.eq(256*60)
        expect(initialized).to.eq(false)
      })
      it('at the word boundary', async () => {
        const { next, initialized } = await tickTable.nextTickInTheSameRow(256*60, true)

        expect(next).to.eq(256*60)
        expect(initialized).to.eq(false)
      })
      it('word boundary less 1 (next initialized tick in next word)', async () => {
        const { next, initialized } = await tickTable.nextTickInTheSameRow(72*60, true)

        expect(next).to.eq(70*60)
        expect(initialized).to.eq(true)
      })
      it('word boundary', async () => {
        const { next, initialized } = await tickTable.nextTickInTheSameRow(-257*60, true)

        expect(next).to.eq(-512*60)
        expect(initialized).to.eq(false)
      })
      it('entire empty word', async () => {
        const { next, initialized } = await tickTable.nextTickInTheSameRow(1023*60, true)

        expect(next).to.eq(768*60)
        expect(initialized).to.eq(false)
      })
      it('halfway through empty word', async () => {
        const { next, initialized } = await tickTable.nextTickInTheSameRow(900*60, true)

        expect(next).to.eq(768*60)
        expect(initialized).to.eq(false)
      })
      it('boundary is initialized', async () => {
        await tickTable.toggleTick(329*60)
        const { next, initialized } = await tickTable.nextTickInTheSameRow(456*60, true)

        expect(next).to.eq(329*60)
        expect(initialized).to.eq(true)
      })

      it('gas cost on boundary  [ @skip-on-coverage ]', async () => {
        await snapshotGasCost(await tickTable.getGasCostOfNextTickInTheSameRow(256*60, true))
      })
      it('gas cost just below boundary  [ @skip-on-coverage ]', async () => {
        await snapshotGasCost(await tickTable.getGasCostOfNextTickInTheSameRow(255*60, true))
      })
      it('gas cost for entire word  [ @skip-on-coverage ]', async () => {
        await snapshotGasCost(await tickTable.getGasCostOfNextTickInTheSameRow(1024*60, true))
      })
    })
  })
})
