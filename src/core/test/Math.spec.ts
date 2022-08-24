import { ethers } from 'hardhat'
import { FullMathTest } from '../typechain/test/FullMathTest'
import { SafeMathTest } from '../typechain/test/SafeMathTest'
import { expect } from './shared/expect'
import { Decimal } from 'decimal.js'

const {
  BigNumber,
  constants: { MaxUint256 },
} = ethers
const Q128 = BigNumber.from(2).pow(128)

Decimal.config({ toExpNeg: -500, toExpPos: 500 })

describe('SafeMath', () => {
  let safeMath: SafeMathTest;

  before('deploy FullMathTest', async () => {
    const factory = await ethers.getContractFactory('SafeMathTest')
    safeMath = (await factory.deploy()) as SafeMathTest
  })

  it('#add', async () => {
    await expect(safeMath.add(BigNumber.from(2).pow(256).sub(1), 1)).to.be.reverted;
  })

  it('#sub', async () => {
    await expect(safeMath.sub(Q128.sub(1), Q128)).to.be.reverted;
  })

  it('#mul', async () => {
    await expect(safeMath.mul(Q128, Q128)).to.be.reverted;
  })

  it('#addInt', async () => {
    await expect(safeMath.addInt(BigNumber.from(2).pow(255).sub(1), 1)).to.be.reverted;
  })

  it('#subInt', async () => {
    await expect(safeMath.subInt(100, BigNumber.from(2).pow(255).sub(1).mul(-1))).to.be.reverted;
    await expect(safeMath.subInt(BigNumber.from(2).pow(255).sub(1), -100)).to.be.reverted;
  })

  it('#add128', async () => {
    await expect(safeMath.add128(Q128.sub(10), 15)).to.be.reverted;
  })
  
  it('#toUint160', async () => {
    await expect(safeMath.toUint160(BigNumber.from(2).pow(255).sub(1))).to.be.reverted;
  })

  it('#toInt128', async () => {
    await expect(safeMath.toInt128(BigNumber.from(2).pow(255).sub(1))).to.be.reverted;
  })

  it('#toInt256', async () => {
    await expect(safeMath.toInt256(BigNumber.from(2).pow(256).sub(1))).to.be.reverted;
  })
})

describe('FullMath', () => {
  let fullMath: FullMathTest
  before('deploy FullMathTest', async () => {
    const factory = await ethers.getContractFactory('FullMathTest')
    fullMath = (await factory.deploy()) as FullMathTest
  })

  describe('#mulDiv', () => {
    it('reverts if denominator is 0', async () => {
      await expect(fullMath.mulDiv(Q128, 5, 0)).to.be.reverted
    })
    it('reverts if denominator is 0 and numerator overflows', async () => {
      await expect(fullMath.mulDiv(Q128, Q128, 0)).to.be.reverted
    })
    it('reverts if output overflows uint256', async () => {
      await expect(fullMath.mulDiv(Q128, Q128, 1)).to.be.reverted
    })
    it('reverts if output overflows uint256', async () => {
      await expect(fullMath.mulDiv(Q128, Q128, 1)).to.be.reverted
    })
    it('reverts on overflow with all max inputs', async () => {
      await expect(fullMath.mulDiv(MaxUint256, MaxUint256, MaxUint256.sub(1))).to.be.reverted
    })

    it('all max inputs', async () => {
      expect(await fullMath.mulDiv(MaxUint256, MaxUint256, MaxUint256)).to.eq(MaxUint256)
    })

    it('accurate without phantom overflow', async () => {
      const result = Q128.div(3)
      expect(
        await fullMath.mulDiv(
          Q128,
          /**0.5=*/ BigNumber.from(50).mul(Q128).div(100),
          /**1.5=*/ BigNumber.from(150).mul(Q128).div(100)
        )
      ).to.eq(result)
    })

    it('accurate with phantom overflow', async () => {
      const result = BigNumber.from(4375).mul(Q128).div(1000)
      expect(await fullMath.mulDiv(Q128, BigNumber.from(35).mul(Q128), BigNumber.from(8).mul(Q128))).to.eq(result)
    })

    it('accurate with phantom overflow and repeating decimal', async () => {
      const result = BigNumber.from(1).mul(Q128).div(3)
      expect(await fullMath.mulDiv(Q128, BigNumber.from(1000).mul(Q128), BigNumber.from(3000).mul(Q128))).to.eq(result)
    })
  })

  describe('#mulDivRoundingUp', () => {
    it('reverts if denominator is 0', async () => {
      await expect(fullMath.mulDivRoundingUp(Q128, 5, 0)).to.be.reverted
    })
    it('reverts if denominator is 0 and numerator overflows', async () => {
      await expect(fullMath.mulDivRoundingUp(Q128, Q128, 0)).to.be.reverted
    })
    it('reverts if output overflows uint256', async () => {
      await expect(fullMath.mulDivRoundingUp(Q128, Q128, 1)).to.be.reverted
    })
    it('reverts on overflow with all max inputs', async () => {
      await expect(fullMath.mulDivRoundingUp(MaxUint256, MaxUint256, MaxUint256.sub(1))).to.be.reverted
    })

    it('reverts if mulDiv overflows 256 bits after rounding up', async () => {
      await expect(
        fullMath.mulDivRoundingUp(
          '535006138814359',
          '432862656469423142931042426214547535783388063929571229938474969',
          '2'
        )
      ).to.be.reverted
    })

    it('reverts if mulDiv overflows 256 bits after rounding up case 2', async () => {
      await expect(
        fullMath.mulDivRoundingUp(
          '115792089237316195423570985008687907853269984659341747863450311749907997002549',
          '115792089237316195423570985008687907853269984659341747863450311749907997002550',
          '115792089237316195423570985008687907853269984653042931687443039491902864365164'
        )
      ).to.be.reverted
    })

    it('all max inputs', async () => {
      expect(await fullMath.mulDivRoundingUp(MaxUint256, MaxUint256, MaxUint256)).to.eq(MaxUint256)
    })

    it('accurate without phantom overflow', async () => {
      const result = Q128.div(3).add(1)
      expect(
        await fullMath.mulDivRoundingUp(
          Q128,
          /**0.5=*/ BigNumber.from(50).mul(Q128).div(100),
          /**1.5=*/ BigNumber.from(150).mul(Q128).div(100)
        )
      ).to.eq(result)
    })

    it('accurate with phantom overflow', async () => {
      const result = BigNumber.from(4375).mul(Q128).div(1000)
      expect(await fullMath.mulDivRoundingUp(Q128, BigNumber.from(35).mul(Q128), BigNumber.from(8).mul(Q128))).to.eq(
        result
      )
    })

    it('accurate with phantom overflow and repeating decimal', async () => {
      const result = BigNumber.from(1).mul(Q128).div(3).add(1)
      expect(
        await fullMath.mulDivRoundingUp(Q128, BigNumber.from(1000).mul(Q128), BigNumber.from(3000).mul(Q128))
      ).to.eq(result)
    })
  })

  function pseudoRandomBigNumber() {
    return BigNumber.from(new Decimal(MaxUint256.toString()).mul(Math.random().toString()).round().toString())
  }

  // tiny fuzzer. unskip to run
  it.skip('check a bunch of random inputs against JS implementation', async () => {
    // generates random inputs
    const tests = Array(1_000)
      .fill(null)
      .map(() => {
        return {
          x: pseudoRandomBigNumber(),
          y: pseudoRandomBigNumber(),
          d: pseudoRandomBigNumber(),
        }
      })
      .map(({ x, y, d }) => {
        return {
          input: {
            x,
            y,
            d,
          },
          floored: fullMath.mulDiv(x, y, d),
          ceiled: fullMath.mulDivRoundingUp(x, y, d),
        }
      })

    await Promise.all(
      tests.map(async ({ input: { x, y, d }, floored, ceiled }) => {
        if (d.eq(0)) {
          await expect(floored).to.be.reverted
          await expect(ceiled).to.be.reverted
          return
        }

        if (x.eq(0) || y.eq(0)) {
          await expect(floored).to.eq(0)
          await expect(ceiled).to.eq(0)
        } else if (x.mul(y).div(d).gt(MaxUint256)) {
          await expect(floored).to.be.reverted
          await expect(ceiled).to.be.reverted
        } else {
          expect(await floored).to.eq(x.mul(y).div(d))
          expect(await ceiled).to.eq(
            x
              .mul(y)
              .div(d)
              .add(x.mul(y).mod(d).gt(0) ? 1 : 0)
          )
        }
      })
    )
  })
})
