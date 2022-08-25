import { ethers } from 'hardhat'
import { BigNumber } from 'ethers'
import { TickTest } from '../typechain/test/TickTest'
import { expect } from './shared/expect'
import { FeeAmount, TICK_SPACINGS, getMaxLiquidityPerTick } from './shared/utilities'
const MaxUint128 = BigNumber.from(2).pow(128).sub(1)

const { constants } = ethers

describe('Tick', () => {
  let tickTest: TickTest

  beforeEach('deploy TickTest', async () => {
    const tickTestFactory = await ethers.getContractFactory('TickTest')
    tickTest = (await tickTestFactory.deploy()) as TickTest
  })

  describe('#getInnerFeeGrowth', () => {
    it('returns all for two uninitialized ticks if tick is inside', async () => {
      const { innerFeeGrowth0Token, innerFeeGrowth1Token } = await tickTest.getInnerFeeGrowth(-2, 2, 0, 15, 15)
      expect(innerFeeGrowth0Token).to.eq(15)
      expect(innerFeeGrowth1Token).to.eq(15)
    })
    it('returns 0 for two uninitialized ticks if tick is above', async () => {
      const { innerFeeGrowth0Token, innerFeeGrowth1Token } = await tickTest.getInnerFeeGrowth(-2, 2, 4, 15, 15)
      expect(innerFeeGrowth0Token).to.eq(0)
      expect(innerFeeGrowth1Token).to.eq(0)
    })
    it('returns 0 for two uninitialized ticks if tick is below', async () => {
      const { innerFeeGrowth0Token, innerFeeGrowth1Token } = await tickTest.getInnerFeeGrowth(-2, 2, -4, 15, 15)
      expect(innerFeeGrowth0Token).to.eq(0)
      expect(innerFeeGrowth1Token).to.eq(0)
    })

    it('subtracts upper tick if below', async () => {
      await tickTest.setTick(2, {
        outerFeeGrowth0Token: 2,
        outerFeeGrowth1Token: 3,
        liquidityTotal: 0,
        liquidityDelta: 0,
        outerSecondsPerLiquidity: 0,
        outerTickCumulative: 0,
        outerSecondsSpent: 0,
        initialized: true,
      })
      const { innerFeeGrowth0Token, innerFeeGrowth1Token } = await tickTest.getInnerFeeGrowth(-2, 2, 0, 15, 15)
      expect(innerFeeGrowth0Token).to.eq(13)
      expect(innerFeeGrowth1Token).to.eq(12)
    })

    it('subtracts lower tick if above', async () => {
      await tickTest.setTick(-2, {
        outerFeeGrowth0Token: 2,
        outerFeeGrowth1Token: 3,
        liquidityTotal: 0,
        liquidityDelta: 0,
        outerSecondsPerLiquidity: 0,
        outerTickCumulative: 0,
        outerSecondsSpent: 0,
        initialized: true,
      })
      const { innerFeeGrowth0Token, innerFeeGrowth1Token } = await tickTest.getInnerFeeGrowth(-2, 2, 0, 15, 15)
      expect(innerFeeGrowth0Token).to.eq(13)
      expect(innerFeeGrowth1Token).to.eq(12)
    })

    it('subtracts upper and lower tick if inside', async () => {
      await tickTest.setTick(-2, {
        outerFeeGrowth0Token: 2,
        outerFeeGrowth1Token: 3,
        liquidityTotal: 0,
        liquidityDelta: 0,
        outerSecondsPerLiquidity: 0,
        outerTickCumulative: 0,
        outerSecondsSpent: 0,
        initialized: true,
      })
      await tickTest.setTick(2, {
        outerFeeGrowth0Token: 4,
        outerFeeGrowth1Token: 1,
        liquidityTotal: 0,
        liquidityDelta: 0,
        outerSecondsPerLiquidity: 0,
        outerTickCumulative: 0,
        outerSecondsSpent: 0,
        initialized: true,
      })
      const { innerFeeGrowth0Token, innerFeeGrowth1Token } = await tickTest.getInnerFeeGrowth(-2, 2, 0, 15, 15)
      expect(innerFeeGrowth0Token).to.eq(9)
      expect(innerFeeGrowth1Token).to.eq(11)
    })

    it('works correctly with overflow on inside tick', async () => {
      await tickTest.setTick(-2, {
        outerFeeGrowth0Token: constants.MaxUint256.sub(3),
        outerFeeGrowth1Token: constants.MaxUint256.sub(2),
        liquidityTotal: 0,
        liquidityDelta: 0,
        outerSecondsPerLiquidity: 0,
        outerTickCumulative: 0,
        outerSecondsSpent: 0,
        initialized: true,
      })
      await tickTest.setTick(2, {
        outerFeeGrowth0Token: 3,
        outerFeeGrowth1Token: 5,
        liquidityTotal: 0,
        liquidityDelta: 0,
        outerSecondsPerLiquidity: 0,
        outerTickCumulative: 0,
        outerSecondsSpent: 0,
        initialized: true,
      })
      const { innerFeeGrowth0Token, innerFeeGrowth1Token } = await tickTest.getInnerFeeGrowth(-2, 2, 0, 15, 15)
      expect(innerFeeGrowth0Token).to.eq(16)
      expect(innerFeeGrowth1Token).to.eq(13)
    })
  })

  describe('#update', async () => {
    it('flips from zero to nonzero', async () => {
      expect(await tickTest.callStatic.update(0, 0, 1, 0, 0, 0, 0, 0, false,)).to.eq(true)
    })
    it('does not flip from nonzero to greater nonzero', async () => {
      await tickTest.update(0, 0, 1, 0, 0, 0, 0, 0, false,)
      expect(await tickTest.callStatic.update(0, 0, 1, 0, 0, 0, 0, 0, false,)).to.eq(false)
    })
    it('flips from nonzero to zero', async () => {
      await tickTest.update(0, 0, 1, 0, 0, 0, 0, 0, false)
      expect(await tickTest.callStatic.update(0, 0, -1, 0, 0, 0, 0, 0, false,)).to.eq(true)
    })
    it('does not flip from nonzero to lesser nonzero', async () => {
      await tickTest.update(0, 0, 2, 0, 0, 0, 0, 0, false,)
      expect(await tickTest.callStatic.update(0, 0, -1, 0, 0, 0, 0, 0, false,)).to.eq(false)
    })
    it('does not flip from nonzero to lesser nonzero', async () => {
      await tickTest.update(0, 0, 2, 0, 0, 0, 0, 0, false,)
      expect(await tickTest.callStatic.update(0, 0, -1, 0, 0, 0, 0, 0, false,)).to.eq(false)
    })
    it('reverts if total liquidity gross is greater than max', async () => {
      await tickTest.update(0, 0, BigNumber.from('11505743598341114571880798222544994').div(2), 0, 0, 0, 0, 0, false,)
      await tickTest.update(0, 0, BigNumber.from('11505743598341114571880798222544994').div(2), 0, 0, 0, 0, 0, true,)
      await expect(tickTest.update(0, 0, BigNumber.from('11505743598341114571880798222544994').div(2), 0, 0, 0, 0, 0, false,)).to.be.revertedWith('LO')
    })
    it('nets the liquidity based on upper flag', async () => {
      await tickTest.update(0, 0, 2, 0, 0, 0, 0, 0, false,)
      await tickTest.update(0, 0, 1, 0, 0, 0, 0, 0, true,)
      await tickTest.update(0, 0, 3, 0, 0, 0, 0, 0, true,)
      await tickTest.update(0, 0, 1, 0, 0, 0, 0, 0, false,)
      const { liquidityTotal, liquidityDelta } = await tickTest.ticks(0)
      expect(liquidityTotal).to.eq(2 + 1 + 3 + 1)
      expect(liquidityDelta).to.eq(2 - 1 - 3 + 1)
    })
    it('reverts on overflow liquidity gross', async () => {
      await tickTest.update(0, 0, BigNumber.from('11505743598341114571880798222544994').div(2).sub(1), 0, 0, 0, 0, 0, false)
      await expect(tickTest.update(0, 0,  MaxUint128.div(2).sub(1), 0, 0, 0, 0, 0, false)).to.be.reverted
    })
    it('assumes all growth happens below ticks lte current tick', async () => {
      await tickTest.update(1, 1, 1, 1, 2, 3, 4, 5, false)
      const {
        outerFeeGrowth0Token,
        outerFeeGrowth1Token,
        outerSecondsSpent,
        outerSecondsPerLiquidity,
        outerTickCumulative,
        initialized,
      } = await tickTest.ticks(1)
      expect(outerFeeGrowth0Token).to.eq(1)
      expect(outerFeeGrowth1Token).to.eq(2)
      expect(outerSecondsPerLiquidity).to.eq(3)
      expect(outerTickCumulative).to.eq(4)
      expect(outerSecondsSpent).to.eq(5)
      expect(initialized).to.eq(true)
    })
    it('does not set any growth fields if tick is already initialized', async () => {
      await tickTest.update(1, 1, 1, 1, 2, 3, 4, 5, false)
      await tickTest.update(1, 1, 1, 6, 7, 8, 9, 10, false)
      const {
        outerFeeGrowth0Token,
        outerFeeGrowth1Token,
        outerSecondsSpent,
        outerSecondsPerLiquidity,
        outerTickCumulative,
        initialized,
      } = await tickTest.ticks(1)
      expect(outerFeeGrowth0Token).to.eq(1)
      expect(outerFeeGrowth1Token).to.eq(2)
      expect(outerSecondsPerLiquidity).to.eq(3)
      expect(outerTickCumulative).to.eq(4)
      expect(outerSecondsSpent).to.eq(5)
      expect(initialized).to.eq(true)
    })
    it('does not set any growth fields for ticks gt current tick', async () => {
      await tickTest.update(2, 1, 1, 1, 2, 3, 4, 5, false)
      const {
        outerFeeGrowth0Token,
        outerFeeGrowth1Token,
        outerSecondsSpent,
        outerSecondsPerLiquidity,
        outerTickCumulative,
        initialized,
      } = await tickTest.ticks(2)
      expect(outerFeeGrowth0Token).to.eq(0)
      expect(outerFeeGrowth1Token).to.eq(0)
      expect(outerSecondsPerLiquidity).to.eq(0)
      expect(outerTickCumulative).to.eq(0)
      expect(outerSecondsSpent).to.eq(0)
      expect(initialized).to.eq(true)
    })
  })

  // this is skipped because the presence of the method causes slither to fail
  describe('#clear', async () => {
    it('deletes all the data in the tick', async () => {
      await tickTest.setTick(2, {
        outerFeeGrowth0Token: 1,
        outerFeeGrowth1Token: 2,
        liquidityTotal: 3,
        liquidityDelta: 4,
        outerSecondsPerLiquidity: 5,
        outerTickCumulative: 6,
        outerSecondsSpent: 7,
        initialized: true,
      })
      await tickTest.clear(2)
      const {
        outerFeeGrowth0Token,
        outerFeeGrowth1Token,
        outerSecondsSpent,
        outerSecondsPerLiquidity,
        liquidityTotal,
        outerTickCumulative,
        liquidityDelta,
        initialized,
      } = await tickTest.ticks(2)
      expect(outerFeeGrowth0Token).to.eq(0)
      expect(outerFeeGrowth1Token).to.eq(0)
      expect(outerSecondsSpent).to.eq(0)
      expect(outerSecondsPerLiquidity).to.eq(0)
      expect(outerTickCumulative).to.eq(0)
      expect(liquidityTotal).to.eq(0)
      expect(liquidityDelta).to.eq(0)
      expect(initialized).to.eq(false)
    })
  })

  describe('#cross', () => {
    it('flips the growth variables', async () => {
      await tickTest.setTick(2, {
        outerFeeGrowth0Token: 1,
        outerFeeGrowth1Token: 2,
        liquidityTotal: 3,
        liquidityDelta: 4,
        outerSecondsPerLiquidity: 5,
        outerTickCumulative: 6,
        outerSecondsSpent: 7,
        initialized: true,
      })
      await tickTest.cross(2, 7, 9, 8, 15, 10)
      const {
        outerFeeGrowth0Token,
        outerFeeGrowth1Token,
        outerSecondsSpent,
        outerTickCumulative,
        outerSecondsPerLiquidity,
      } = await tickTest.ticks(2)
      expect(outerFeeGrowth0Token).to.eq(6)
      expect(outerFeeGrowth1Token).to.eq(7)
      expect(outerSecondsPerLiquidity).to.eq(3)
      expect(outerTickCumulative).to.eq(9)
      expect(outerSecondsSpent).to.eq(3)
    })
    it('two flips are no op', async () => {
      await tickTest.setTick(2, {
        outerFeeGrowth0Token: 1,
        outerFeeGrowth1Token: 2,
        liquidityTotal: 3,
        liquidityDelta: 4,
        outerSecondsPerLiquidity: 5,
        outerTickCumulative: 6,
        outerSecondsSpent: 7,
        initialized: true,
      })
      await tickTest.cross(2, 7, 9, 8, 15, 10)
      await tickTest.cross(2, 7, 9, 8, 15, 10)
      const {
        outerFeeGrowth0Token,
        outerFeeGrowth1Token,
        outerSecondsSpent,
        outerTickCumulative,
        outerSecondsPerLiquidity,
      } = await tickTest.ticks(2)
      expect(outerFeeGrowth0Token).to.eq(1)
      expect(outerFeeGrowth1Token).to.eq(2)
      expect(outerSecondsPerLiquidity).to.eq(5)
      expect(outerTickCumulative).to.eq(6)
      expect(outerSecondsSpent).to.eq(7)
    })
  })
})
