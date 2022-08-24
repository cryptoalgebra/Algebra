import { BigNumber, constants } from 'ethers'
import { ethers } from 'hardhat'
import { TokenDeltaMathTest } from '../typechain/test/TokenDeltaMathTest'

import { expect } from './shared/expect'
import snapshotGasCost from './shared/snapshotGasCost'
import { encodePriceSqrt, expandTo18Decimals, MaxUint128 } from './shared/utilities'

const {
  constants: { MaxUint256 },
} = ethers

describe('TokenDeltaMath', () => {
  let sqrtPriceMath: TokenDeltaMathTest
  before(async () => {
    const sqrtPriceMathTestFactory = await ethers.getContractFactory('TokenDeltaMathTest')
    sqrtPriceMath = (await sqrtPriceMathTestFactory.deploy()) as TokenDeltaMathTest
  })

  describe('#getNewPriceAfterInput', () => {
    it('fails if price is zero', async () => {
      await expect(sqrtPriceMath.getNewPriceAfterInput(0, 0, expandTo18Decimals(1).div(10), false)).to.be.reverted
    })

    it('fails if liquidity is zero', async () => {
      await expect(sqrtPriceMath.getNewPriceAfterInput(1, 0, expandTo18Decimals(1).div(10), true)).to.be.reverted
    })

    it('fails if input amount overflows the price', async () => {
      const price = BigNumber.from(2).pow(160).sub(1)
      const liquidity = 1024
      const amountIn = 1024
      await expect(sqrtPriceMath.getNewPriceAfterInput(price, liquidity, amountIn, false)).to.be.reverted
    })

    it('any input amount cannot underflow the price', async () => {
      const price = 1
      const liquidity = 1
      const amountIn = BigNumber.from(2).pow(255)
      expect(await sqrtPriceMath.getNewPriceAfterInput(price, liquidity, amountIn, true)).to.eq(1)
    })

    it('returns input price if amount in is zero and zeroToOne = true', async () => {
      const price = encodePriceSqrt(1, 1)
      expect(await sqrtPriceMath.getNewPriceAfterInput(price, expandTo18Decimals(1).div(10), 0, true)).to.eq(price)
    })

    it('returns input price if amount in is zero and zeroToOne = false', async () => {
      const price = encodePriceSqrt(1, 1)
      expect(await sqrtPriceMath.getNewPriceAfterInput(price, expandTo18Decimals(1).div(10), 0, false)).to.eq(price)
    })

    it('returns the minimum price for max inputs', async () => {
      const sqrtP = BigNumber.from(2).pow(160).sub(1)
      const liquidity = MaxUint128
      const maxAmountNoOverflow = MaxUint256.sub(liquidity.shl(96).div(sqrtP))
      expect(await sqrtPriceMath.getNewPriceAfterInput(sqrtP, liquidity, maxAmountNoOverflow, true)).to.eq('1')
    })

    it('input amount of 0.1 token1', async () => {
      const sqrtQ = await sqrtPriceMath.getNewPriceAfterInput(
        encodePriceSqrt(1, 1),
        expandTo18Decimals(1),
        expandTo18Decimals(1).div(10),
        false
      )
      expect(sqrtQ).to.eq('87150978765690771352898345369')
    })

    it('input amount of 0.1 token0', async () => {
      const sqrtQ = await sqrtPriceMath.getNewPriceAfterInput(
        encodePriceSqrt(1, 1),
        expandTo18Decimals(1),
        expandTo18Decimals(1).div(10),
        true
      )
      expect(sqrtQ).to.eq('72025602285694852357767227579')
    })

    it('amountIn > type(uint96).max and zeroToOne = true', async () => {
      expect(
        await sqrtPriceMath.getNewPriceAfterInput(
          encodePriceSqrt(1, 1),
          expandTo18Decimals(10),
          BigNumber.from(2).pow(100),
          true
        )
        // perfect answer:
        // https://www.wolframalpha.com/input/?i=624999999995069620+-+%28%281e19+*+1+%2F+%281e19+%2B+2%5E100+*+1%29%29+*+2%5E96%29
      ).to.eq('624999999995069620')
    })

    it('can return 1 with enough amountIn and zeroToOne = true', async () => {
      expect(
        await sqrtPriceMath.getNewPriceAfterInput(encodePriceSqrt(1, 1), 1, constants.MaxUint256.div(2), true)
      ).to.eq(1)
    })

    it('zeroToOne = true gas  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(
        sqrtPriceMath.getGasCostOfGetNewPriceAfterInput(
          encodePriceSqrt(1, 1),
          expandTo18Decimals(1),
          expandTo18Decimals(1).div(10),
          true
        )
      )
    })

    it('zeroToOne = false gas  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(
        sqrtPriceMath.getGasCostOfGetNewPriceAfterInput(
          encodePriceSqrt(1, 1),
          expandTo18Decimals(1),
          expandTo18Decimals(1).div(10),
          false
        )
      )
    })
  })

  describe('#getNewPriceAfterOutput', () => {
    it('fails if price is zero', async () => {
      await expect(sqrtPriceMath.getNewPriceAfterOutput(0, 0, expandTo18Decimals(1).div(10), false)).to.be.reverted
    })

    it('fails if liquidity is zero', async () => {
      await expect(sqrtPriceMath.getNewPriceAfterOutput(1, 0, expandTo18Decimals(1).div(10), true)).to.be.reverted
    })

    it('fails if output amount is exactly the virtual reserves of token0', async () => {
      const price = '20282409603651670423947251286016'
      const liquidity = 1024
      const amountOut = 4
      await expect(sqrtPriceMath.getNewPriceAfterOutput(price, liquidity, amountOut, false)).to.be.reverted
    })

    it('fails if output amount is greater than virtual reserves of token0', async () => {
      const price = '20282409603651670423947251286016'
      const liquidity = 1024
      const amountOut = 5
      await expect(sqrtPriceMath.getNewPriceAfterOutput(price, liquidity, amountOut, false)).to.be.reverted
    })

    it('fails if output amount is greater than virtual reserves of token1', async () => {
      const price = '20282409603651670423947251286016'
      const liquidity = 1024
      const amountOut = 262145
      await expect(sqrtPriceMath.getNewPriceAfterOutput(price, liquidity, amountOut, true)).to.be.reverted
    })

    it('fails if output amount is exactly the virtual reserves of token1', async () => {
      const price = '20282409603651670423947251286016'
      const liquidity = 1024
      const amountOut = 262144
      await expect(sqrtPriceMath.getNewPriceAfterOutput(price, liquidity, amountOut, true)).to.be.reverted
    })

    it('succeeds if output amount is just less than the virtual reserves of token1', async () => {
      const price = '20282409603651670423947251286016'
      const liquidity = 1024
      const amountOut = 262143
      const sqrtQ = await sqrtPriceMath.getNewPriceAfterOutput(price, liquidity, amountOut, true)
      expect(sqrtQ).to.eq('77371252455336267181195264')
    })

    it('puzzling echidna test', async () => {
      const price = '20282409603651670423947251286016'
      const liquidity = 1024
      const amountOut = 4

      await expect(sqrtPriceMath.getNewPriceAfterOutput(price, liquidity, amountOut, false)).to.be.reverted
    })

    it('returns input price if amount in is zero and zeroToOne = true', async () => {
      const price = encodePriceSqrt(1, 1)
      expect(await sqrtPriceMath.getNewPriceAfterOutput(price, expandTo18Decimals(1).div(10), 0, true)).to.eq(price)
    })

    it('returns input price if amount in is zero and zeroToOne = false', async () => {
      const price = encodePriceSqrt(1, 1)
      expect(await sqrtPriceMath.getNewPriceAfterOutput(price, expandTo18Decimals(1).div(10), 0, false)).to.eq(
        price
      )
    })

    it('output amount of 0.1 token1', async () => {
      const sqrtQ = await sqrtPriceMath.getNewPriceAfterOutput(
        encodePriceSqrt(1, 1),
        expandTo18Decimals(1),
        expandTo18Decimals(1).div(10),
        false
      )
      expect(sqrtQ).to.eq('88031291682515930659493278152')
    })

    it('output amount of 0.1 token1', async () => {
      const sqrtQ = await sqrtPriceMath.getNewPriceAfterOutput(
        encodePriceSqrt(1, 1),
        expandTo18Decimals(1),
        expandTo18Decimals(1).div(10),
        true
      )
      expect(sqrtQ).to.eq('71305346262837903834189555302')
    })

    it('reverts if amountOut is impossible in zero for one direction', async () => {
      await expect(sqrtPriceMath.getNewPriceAfterOutput(encodePriceSqrt(1, 1), 1, constants.MaxUint256, true)).to.be
        .reverted
    })

    it('reverts if amountOut is impossible in one for zero direction', async () => {
      await expect(sqrtPriceMath.getNewPriceAfterOutput(encodePriceSqrt(1, 1), 1, constants.MaxUint256, false)).to
        .be.reverted
    })

    it('zeroToOne = true gas  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(
        sqrtPriceMath.getGasCostOfGetNewPriceAfterOutput(
          encodePriceSqrt(1, 1),
          expandTo18Decimals(1),
          expandTo18Decimals(1).div(10),
          true
        )
      )
    })

    it('zeroToOne = false gas  [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(
        sqrtPriceMath.getGasCostOfGetNewPriceAfterOutput(
          encodePriceSqrt(1, 1),
          expandTo18Decimals(1),
          expandTo18Decimals(1).div(10),
          false
        )
      )
    })
  })

  describe('#getToken0Delta', () => {
    it('fails if prices are incorrect', async () => {
      await expect(sqrtPriceMath.getToken0Delta(encodePriceSqrt(2, 1), encodePriceSqrt(1, 1) , 0, true)).to.be.reverted;
      await expect(sqrtPriceMath.getToken0Delta(0, encodePriceSqrt(2, 1) , 0, true)).to.be.reverted;
    })
    it('returns 0 if liquidity is 0', async () => {
      const amount0 = await sqrtPriceMath.getToken0Delta(encodePriceSqrt(1, 1), encodePriceSqrt(2, 1), 0, true)

      expect(amount0).to.eq(0)
    })
    it('returns 0 if prices are equal', async () => {
      const amount0 = await sqrtPriceMath.getToken0Delta(encodePriceSqrt(1, 1), encodePriceSqrt(1, 1), 0, true)

      expect(amount0).to.eq(0)
    })

    it('returns 0.1 amount1 for price of 1 to 1.21', async () => {
      const amount0 = await sqrtPriceMath.getToken0Delta(
        encodePriceSqrt(1, 1),
        encodePriceSqrt(121, 100),
        expandTo18Decimals(1),
        true
      )
      expect(amount0).to.eq('90909090909090910')

      const amount0RoundedDown = await sqrtPriceMath.getToken0Delta(
        encodePriceSqrt(1, 1),
        encodePriceSqrt(121, 100),
        expandTo18Decimals(1),
        false
      )

      expect(amount0RoundedDown).to.eq(amount0.sub(1))
    })

    it('works for prices that overflow', async () => {
      const amount0Up = await sqrtPriceMath.getToken0Delta(
        encodePriceSqrt(BigNumber.from(2).pow(90), 1),
        encodePriceSqrt(BigNumber.from(2).pow(96), 1),
        expandTo18Decimals(1),
        true
      )
      const amount0Down = await sqrtPriceMath.getToken0Delta(
        encodePriceSqrt(BigNumber.from(2).pow(90), 1),
        encodePriceSqrt(BigNumber.from(2).pow(96), 1),
        expandTo18Decimals(1),
        false
      )
      expect(amount0Up).to.eq(amount0Down.add(1))
    })

    it(`gas cost for amount0 where roundUp = true  [ @skip-on-coverage ]`, async () => {
      await snapshotGasCost(
        sqrtPriceMath.getGasCostOfGetToken0Delta(
          encodePriceSqrt(100, 121),
          encodePriceSqrt(1, 1),
          expandTo18Decimals(1),
          true
        )
      )
    })

    it(`gas cost for amount0 where roundUp = true  [ @skip-on-coverage ]`, async () => {
      await snapshotGasCost(
        sqrtPriceMath.getGasCostOfGetToken0Delta(
          encodePriceSqrt(100, 121),
          encodePriceSqrt(1, 1),
          expandTo18Decimals(1),
          false
        )
      )
    })
  })

  describe('#getToken1Delta', () => {
    it('fails if prices are incorrect', async () => {
      await expect(sqrtPriceMath.getToken1Delta(encodePriceSqrt(2, 1), encodePriceSqrt(1, 1) , 0, true)).to.be.reverted;
    })
    it('returns 0 if liquidity is 0', async () => {
      const amount1 = await sqrtPriceMath.getToken1Delta(encodePriceSqrt(1, 1), encodePriceSqrt(2, 1), 0, true)

      expect(amount1).to.eq(0)
    })
    it('returns 0 if prices are equal', async () => {
      const amount1 = await sqrtPriceMath.getToken0Delta(encodePriceSqrt(1, 1), encodePriceSqrt(1, 1), 0, true)

      expect(amount1).to.eq(0)
    })

    it('returns 0.1 amount1 for price of 1 to 1.21', async () => {
      const amount1 = await sqrtPriceMath.getToken1Delta(
        encodePriceSqrt(1, 1),
        encodePriceSqrt(121, 100),
        expandTo18Decimals(1),
        true
      )

      expect(amount1).to.eq('100000000000000000')
      const amount1RoundedDown = await sqrtPriceMath.getToken1Delta(
        encodePriceSqrt(1, 1),
        encodePriceSqrt(121, 100),
        expandTo18Decimals(1),
        false
      )

      expect(amount1RoundedDown).to.eq(amount1.sub(1))
    })

    it(`gas cost for amount0 where roundUp = true  [ @skip-on-coverage ]`, async () => {
      await snapshotGasCost(
        sqrtPriceMath.getGasCostOfGetToken0Delta(
          encodePriceSqrt(100, 121),
          encodePriceSqrt(1, 1),
          expandTo18Decimals(1),
          true
        )
      )
    })

    it(`gas cost for amount0 where roundUp = false  [ @skip-on-coverage ]`, async () => {
      await snapshotGasCost(
        sqrtPriceMath.getGasCostOfGetToken0Delta(
          encodePriceSqrt(100, 121),
          encodePriceSqrt(1, 1),
          expandTo18Decimals(1),
          false
        )
      )
    })
  })

  describe('swap computation', () => {
    it('sqrtP * sqrtQ overflows', async () => {
      // getNextSqrtPriceInvariants(1025574284609383690408304870162715216695788925244,50015962439936049619261659728067971248,406,true)
      const sqrtP = '1025574284609383690408304870162715216695788925244'
      const liquidity = '50015962439936049619261659728067971248'
      const zeroToOne = true
      const amountIn = '406'

      const sqrtQ = await sqrtPriceMath.getNewPriceAfterInput(sqrtP, liquidity, amountIn, zeroToOne)
      expect(sqrtQ).to.eq('1025574284609383582644711336373707553698163132913')

      const amount0Delta = await sqrtPriceMath.getToken0Delta(sqrtQ, sqrtP, liquidity, true)
      expect(amount0Delta).to.eq('406')
    })
  })
})