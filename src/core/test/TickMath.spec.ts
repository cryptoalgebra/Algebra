import { ethers } from 'hardhat'
import { TickMathTest } from '../typechain'
import { expect } from './shared/expect'
import snapshotGasCost from './shared/snapshotGasCost'
import { encodePriceSqrt, MIN_SQRT_RATIO, MAX_SQRT_RATIO } from './shared/utilities'
import Decimal from 'decimal.js'

const MIN_TICK = -887272
const MAX_TICK = 887272

Decimal.config({ toExpNeg: -500, toExpPos: 500 })

describe('TickMath', () => {
  let tickMath: TickMathTest

  before('deploy TickMathTest', async () => {
    const factory = await ethers.getContractFactory('TickMathTest')
    tickMath = (await factory.deploy()) as any as TickMathTest
  })

  describe('#getSqrtRatioAtTick', () => {
    it('throws for too low', async () => {
      await expect(tickMath.getSqrtRatioAtTick(MIN_TICK - 1)).to.be.revertedWithCustomError(tickMath, 'tickOutOfRange');
    })

    it('throws for too low', async () => {
      await expect(tickMath.getSqrtRatioAtTick(MAX_TICK + 1)).to.be.revertedWithCustomError(tickMath, 'tickOutOfRange');
    })

    it('min tick', async () => {
      expect(await tickMath.getSqrtRatioAtTick(MIN_TICK)).to.eq('4295128739')
    })

    it('min tick +1', async () => {
      expect(await tickMath.getSqrtRatioAtTick(MIN_TICK + 1)).to.eq('4295343490')
    })

    it('max tick - 1', async () => {
      expect(await tickMath.getSqrtRatioAtTick(MAX_TICK - 1)).to.eq('1461373636630004318706518188784493106690254656249')
    })

    it('min tick ratio is less than js implementation', async () => {
      expect(await tickMath.getSqrtRatioAtTick(MIN_TICK)).to.be.lt(encodePriceSqrt(1, 2n ** (127n)))
    })

    it('max tick ratio is greater than js implementation', async () => {
      expect(await tickMath.getSqrtRatioAtTick(MAX_TICK)).to.be.gt(encodePriceSqrt(2n ** (127n), 1))
    })

    it('max tick', async () => {
      expect(await tickMath.getSqrtRatioAtTick(MAX_TICK)).to.eq('1461446703485210103287273052203988822378723970342')
    })

    for (const absTick of [
      50,
      100,
      250,
      500,
      1_000,
      2_500,
      3_000,
      4_000,
      5_000,
      50_000,
      150_000,
      250_000,
      500_000,
      738_203,
    ]) {
      for (const tick of [-absTick, absTick]) {
        describe(`tick ${tick}`, () => {
          it('is at most off by 1/100th of a bips', async () => {
            const jsResult = new Decimal(1.0001).pow(tick).sqrt().mul(new Decimal(2).pow(96))
            const result = await tickMath.getSqrtRatioAtTick(tick)
            const absDiff = new Decimal(result.toString()).sub(jsResult).abs()
            expect(absDiff.div(jsResult).toNumber()).to.be.lt(0.000001)
          })
          it('result', async () => {
            expect((await tickMath.getSqrtRatioAtTick(tick)).toString()).to.matchSnapshot()
          })
          it('gas [ @skip-on-coverage ]', async () => {
            await snapshotGasCost(tickMath.getGasCostOfGetSqrtRatioAtTick(tick))
          })
        })
      }
    }
  })

  describe('#MIN_SQRT_RATIO', async () => {
    it('equals #getSqrtRatioAtTick(MIN_TICK)', async () => {
      const min = await tickMath.getSqrtRatioAtTick(MIN_TICK)
      expect(min).to.eq(await tickMath.MIN_SQRT_RATIO())
      expect(min).to.eq(MIN_SQRT_RATIO)
    })
  })

  describe('#MAX_SQRT_RATIO', async () => {
    it('equals #getSqrtRatioAtTick(MAX_TICK)', async () => {
      const max = await tickMath.getSqrtRatioAtTick(MAX_TICK)
      expect(max).to.eq(await tickMath.MAX_SQRT_RATIO())
      expect(max).to.eq(MAX_SQRT_RATIO)
    })
  })

  describe('#getTickAtSqrtRatio', () => {
    it('throws for too low', async () => {
      await expect(tickMath.getTickAtSqrtRatio(MIN_SQRT_RATIO - 1n)).to.be.revertedWithCustomError(tickMath, 'priceOutOfRange');
    })

    it('throws for too high', async () => {
      await expect(tickMath.getTickAtSqrtRatio(MAX_SQRT_RATIO)).to.be.revertedWithCustomError(tickMath, 'priceOutOfRange');
    })

    it('ratio of min tick', async () => {
      expect(await tickMath.getTickAtSqrtRatio(MIN_SQRT_RATIO)).to.eq(MIN_TICK)
    })
    it('ratio of min tick + 1', async () => {
      expect(await tickMath.getTickAtSqrtRatio('4295343490')).to.eq(MIN_TICK + 1)
    })
    it('ratio of max tick - 1', async () => {
      expect(await tickMath.getTickAtSqrtRatio('1461373636630004318706518188784493106690254656249')).to.eq(MAX_TICK - 1)
    })
    it('ratio closest to max tick', async () => {
      expect(await tickMath.getTickAtSqrtRatio(MAX_SQRT_RATIO - 1n)).to.eq(MAX_TICK - 1)
    })

    for (const ratio of [
      MIN_SQRT_RATIO,
      encodePriceSqrt(10n ** (12n), 1),
      encodePriceSqrt(10n ** (6n), 1),
      encodePriceSqrt(1, 64),
      encodePriceSqrt(1, 8),
      encodePriceSqrt(1, 2),
      encodePriceSqrt(1, 1),
      encodePriceSqrt(2, 1),
      encodePriceSqrt(8, 1),
      encodePriceSqrt(64, 1),
      encodePriceSqrt(1, 10n ** (6n)),
      encodePriceSqrt(1, 10n ** (12n)),
      MAX_SQRT_RATIO - 1n,
    ]) {
      describe(`ratio ${ratio}`, () => {
        it('is at most off by 1', async () => {
          const jsResult = new Decimal(ratio.toString()).div(new Decimal(2).pow(96)).pow(2).log(1.0001).floor()
          const result = await tickMath.getTickAtSqrtRatio(ratio)
          const absDiff = new Decimal(result.toString()).sub(jsResult).abs()
          expect(absDiff.toNumber()).to.be.lte(1)
        })
        it('ratio is between the tick and tick+1', async () => {
          const tick = await tickMath.getTickAtSqrtRatio(ratio)
          const ratioOfTick = await tickMath.getSqrtRatioAtTick(tick)
          const ratioOfTickPlusOne = await tickMath.getSqrtRatioAtTick(tick + 1n)
          expect(ratio).to.be.gte(ratioOfTick)
          expect(ratio).to.be.lt(ratioOfTickPlusOne)
        })
        it('result', async () => {
          expect(Number(await tickMath.getTickAtSqrtRatio(ratio))).to.matchSnapshot()
        })
        it('gas [ @skip-on-coverage ]', async () => {
          await snapshotGasCost(tickMath.getGasCostOfGetTickAtSqrtRatio(ratio))
        })
      })
    }
  })
})