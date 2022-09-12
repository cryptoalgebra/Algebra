import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'
import { PriceMovementMathTest } from '../typechain/test/PriceMovementMathTest'
import * as fs from 'fs';
import { expect } from './shared/expect'
import snapshotGasCost from './shared/snapshotGasCost'
import { encodePriceSqrt, expandTo18Decimals } from './shared/utilities'
import { TokenDeltaMathTest } from '../typechain/test/TokenDeltaMathTest'

describe('PriceMovementMath', () => {
  let PriceMovementMath: PriceMovementMathTest
  let sqrtPriceMath: TokenDeltaMathTest
  before(async () => {
    const PriceMovementMathTestFactory = await ethers.getContractFactory('PriceMovementMathTest')
    const sqrtPriceMathTestFactory = await ethers.getContractFactory('TokenDeltaMathTest')
    PriceMovementMath = (await PriceMovementMathTestFactory.deploy()) as PriceMovementMathTest
    sqrtPriceMath = (await sqrtPriceMathTestFactory.deploy()) as TokenDeltaMathTest
  })

  describe('#calculatePriceImpactFee', () => {
    it('values for fixed start tick, move price down', async () => {
        let startTick = 1000;
        let base = Number(1.0001);
        let fee = 100;
        let currentPrice =  Math.floor(((base ** startTick) ** 0.5) * Number('2')**Number('96'));

        let tickDs = [];
        let results = [];
        for(let tickD = 1; tickD < 2000; tickD++) {
          tickDs.push(tickD/10)
          let endPrice = Math.floor(((base ** (startTick - tickD/4)) ** 0.5) * Number('2')**Number('96'));
          results.push(
            (await PriceMovementMath.calculatePriceImpactFee(fee, startTick, BigInt(currentPrice), BigInt(endPrice))).toString()
            )
        }

        fs.writeFileSync('./PIfee_out_down.json', JSON.stringify({tickDs, results}));
    })

    it('values for fixed start tick, move price up', async () => {
      let startTick = 15000;
      let base = Number(1.0001);
      let currentPrice =  Math.floor(((base ** startTick) ** 0.5) * Number('2')**Number('96'));
      let fee = 100;

      let tickDs = [];
      let results = [];
      for(let tickD = 1; tickD < 2000; tickD++) {
        tickDs.push(tickD/10)
        let endPrice = Math.floor(((base ** (startTick + tickD/4)) ** 0.5) * Number('2')**Number('96'));
        results.push(
          (await PriceMovementMath.calculatePriceImpactFee(fee, startTick, BigInt(currentPrice), BigInt(endPrice))).toString()
          )
      }
      
      fs.writeFileSync('./PIfee_out_up.json', JSON.stringify({tickDs, results}));
  })
  })

  describe('#movePriceTowardsTarget', () => {
    it('exact amount in that gets capped at price target in one for zero', async () => {
      const price = encodePriceSqrt(1, 1)
      const priceTarget = encodePriceSqrt(101, 100)
      const liquidity = expandTo18Decimals(2)
      const amount = expandTo18Decimals(1)
      const fee = 600
      const zeroToOne = false

      const { amountIn, amountOut, sqrtQ, feeAmount } = await PriceMovementMath.movePriceTowardsTarget(
        price,
        priceTarget,
        liquidity,
        amount,
        fee
      )

      expect(amountIn).to.eq('9975124224178055')
      expect(feeAmount).to.eq('5988667735148')
      expect(amountOut).to.eq('9925619580021728')
      expect(amountIn.add(feeAmount), 'entire amount is not used').to.lt(amount)

      const priceAfterWholeInputAmount = await sqrtPriceMath.getNewPriceAfterInput(
        price,
        liquidity,
        amount,
        zeroToOne
      )

      expect(sqrtQ, 'price is capped at price target').to.eq(priceTarget)
      expect(sqrtQ, 'price is less than price after whole input amount').to.lt(priceAfterWholeInputAmount)
    })

    it('exact amount out that gets capped at price target in one for zero', async () => {
      const price = encodePriceSqrt(1, 1)
      const priceTarget = encodePriceSqrt(101, 100)
      const liquidity = expandTo18Decimals(2)
      const amount = expandTo18Decimals(1).mul(-1)
      const fee = 600
      const zeroToOne = false

      const { amountIn, amountOut, sqrtQ, feeAmount } = await PriceMovementMath.movePriceTowardsTarget(
        price,
        priceTarget,
        liquidity,
        amount,
        fee
      )

      expect(amountIn).to.eq('9975124224178055')
      expect(feeAmount).to.eq('5988667735148')
      expect(amountOut).to.eq('9925619580021728')
      expect(amountOut, 'entire amount out is not returned').to.lt(amount.mul(-1))

      const priceAfterWholeOutputAmount = await sqrtPriceMath.getNewPriceAfterOutput(
        price,
        liquidity,
        amount.mul(-1),
        zeroToOne
      )

      expect(sqrtQ, 'price is capped at price target').to.eq(priceTarget)
      expect(sqrtQ, 'price is less than price after whole output amount').to.lt(priceAfterWholeOutputAmount)
    })

    it('exact amount in that is fully spent in one for zero', async () => {
      const price = encodePriceSqrt(1, 1)
      const priceTarget = encodePriceSqrt(1000, 100)
      const liquidity = expandTo18Decimals(2)
      const amount = expandTo18Decimals(1)
      const fee = 600
      const zeroToOne = false

      const { amountIn, amountOut, sqrtQ, feeAmount } = await PriceMovementMath.movePriceTowardsTarget(
        price,
        priceTarget,
        liquidity,
        amount,
        fee
      )

      expect(amountIn).to.eq('999400000000000000')
      expect(feeAmount).to.eq('600000000000000')
      expect(amountOut).to.eq('666399946655997866')
      expect(amountIn.add(feeAmount), 'entire amount is used').to.eq(amount)

      const priceAfterWholeInputAmountLessFee = await sqrtPriceMath.getNewPriceAfterInput(
        price,
        liquidity,
        amount.sub(feeAmount),
        zeroToOne
      )

      expect(sqrtQ, 'price does not reach price target').to.be.lt(priceTarget)
      expect(sqrtQ, 'price is equal to price after whole input amount').to.eq(priceAfterWholeInputAmountLessFee)
    })

    it('exact amount out that is fully received in one for zero', async () => {
      const price = encodePriceSqrt(1, 1)
      const priceTarget = encodePriceSqrt(10000, 100)
      const liquidity = expandTo18Decimals(2)
      const amount = expandTo18Decimals(1).mul(-1)
      const fee = 600
      const zeroToOne = false

      const { amountIn, amountOut, sqrtQ, feeAmount } = await PriceMovementMath.movePriceTowardsTarget(
        price,
        priceTarget,
        liquidity,
        amount,
        fee
      )

      expect(amountIn).to.eq('2000000000000000000')
      expect(feeAmount).to.eq('1200720432259356')
      expect(amountOut).to.eq(amount.mul(-1))

      const priceAfterWholeOutputAmount = await sqrtPriceMath.getNewPriceAfterOutput(
        price,
        liquidity,
        amount.mul(-1),
        zeroToOne
      )

      expect(sqrtQ, 'price does not reach price target').to.be.lt(priceTarget)
      expect(sqrtQ, 'price is less than price after whole output amount').to.eq(priceAfterWholeOutputAmount)
    })

    it('amount out is capped at the desired amount out', async () => {
      const { amountIn, amountOut, sqrtQ, feeAmount } = await PriceMovementMath.movePriceTowardsTarget(
        BigNumber.from('417332158212080721273783715441582'),
        BigNumber.from('1452870262520218020823638996'),
        '159344665391607089467575320103',
        '-1',
        1
      )
      expect(amountIn).to.eq('1')
      expect(feeAmount).to.eq('1')
      expect(amountOut).to.eq('1') // would be 2 if not capped
      expect(sqrtQ).to.eq('417332158212080721273783715441581')
    })

    it('target price of 1 uses partial input amount', async () => {
      const { amountIn, amountOut, sqrtQ, feeAmount } = await PriceMovementMath.movePriceTowardsTarget(
        BigNumber.from('2'),
        BigNumber.from('1'),
        '1',
        '3915081100057732413702495386755767',
        1
      )
      expect(amountIn).to.eq('39614081257132168796771975168')
      expect(feeAmount).to.eq('39614120871253040049813')
      expect(amountIn.add(feeAmount)).to.be.lte('3915081100057732413702495386755767')
      expect(amountOut).to.eq('0')
      expect(sqrtQ).to.eq('1')
    })

    it('entire input amount taken as fee', async () => {
      const { amountIn, amountOut, sqrtQ, feeAmount } = await PriceMovementMath.movePriceTowardsTarget(
        '2413',
        '79887613182836312',
        '1985041575832132834610021537970',
        '10',
        1872
      )
      expect(amountIn).to.eq('0')
      expect(feeAmount).to.eq('10')
      expect(amountOut).to.eq('0')
      expect(sqrtQ).to.eq('2413')
    })

    it('handles intermediate insufficient liquidity in zero for one exact output case', async () => {
      const sqrtP = BigNumber.from('20282409603651670423947251286016')
      const sqrtPTarget = sqrtP.mul(11).div(10)
      const liquidity = 1024
      // virtual reserves of one are only 4
      // https://www.wolframalpha.com/input/?i=1024+%2F+%2820282409603651670423947251286016+%2F+2**96%29
      const amountRemaining = -4
      const feePips = 3000
      const { amountIn, amountOut, sqrtQ, feeAmount } = await PriceMovementMath.movePriceTowardsTarget(
        sqrtP,
        sqrtPTarget,
        liquidity,
        amountRemaining,
        feePips
      )
      expect(amountOut).to.eq(0)
      expect(sqrtQ).to.eq(sqrtPTarget)
      expect(amountIn).to.eq(26215)
      expect(feeAmount).to.eq(79)
    })

    it('handles intermediate insufficient liquidity in one for zero exact output case', async () => {
      const sqrtP = BigNumber.from('20282409603651670423947251286016')
      const sqrtPTarget = sqrtP.mul(9).div(10)
      const liquidity = 1024
      // virtual reserves of zero are only 262144
      // https://www.wolframalpha.com/input/?i=1024+*+%2820282409603651670423947251286016+%2F+2**96%29
      const amountRemaining = -263000
      const feePips = 3000
      const { amountIn, amountOut, sqrtQ, feeAmount } = await PriceMovementMath.movePriceTowardsTarget(
        sqrtP,
        sqrtPTarget,
        liquidity,
        amountRemaining,
        feePips
      )
      expect(amountOut).to.eq(26214)
      expect(sqrtQ).to.eq(sqrtPTarget)
      expect(amountIn).to.eq(1)
      expect(feeAmount).to.eq(1)
    })

    describe('gas  [ @skip-on-coverage ]', () => {
      it('swap one for zero exact in capped', async () => {
        await snapshotGasCost(
          PriceMovementMath.getGasCostOfmovePriceTowardsTarget(
            encodePriceSqrt(1, 1),
            encodePriceSqrt(101, 100),
            expandTo18Decimals(2),
            expandTo18Decimals(1),
            600
          )
        )
      })
      it('swap zero for one exact in capped', async () => {
        await snapshotGasCost(
          PriceMovementMath.getGasCostOfmovePriceTowardsTarget(
            encodePriceSqrt(1, 1),
            encodePriceSqrt(99, 100),
            expandTo18Decimals(2),
            expandTo18Decimals(1),
            600
          )
        )
      })
      it('swap one for zero exact out capped', async () => {
        await snapshotGasCost(
          PriceMovementMath.getGasCostOfmovePriceTowardsTarget(
            encodePriceSqrt(1, 1),
            encodePriceSqrt(101, 100),
            expandTo18Decimals(2),
            expandTo18Decimals(1).mul(-1),
            600
          )
        )
      })
      it('swap zero for one exact out capped', async () => {
        await snapshotGasCost(
          PriceMovementMath.getGasCostOfmovePriceTowardsTarget(
            encodePriceSqrt(1, 1),
            encodePriceSqrt(99, 100),
            expandTo18Decimals(2),
            expandTo18Decimals(1).mul(-1),
            600
          )
        )
      })
      it('swap one for zero exact in partial', async () => {
        await snapshotGasCost(
          PriceMovementMath.getGasCostOfmovePriceTowardsTarget(
            encodePriceSqrt(1, 1),
            encodePriceSqrt(1010, 100),
            expandTo18Decimals(2),
            1000,
            600
          )
        )
      })
      it('swap zero for one exact in partial', async () => {
        await snapshotGasCost(
          PriceMovementMath.getGasCostOfmovePriceTowardsTarget(
            encodePriceSqrt(1, 1),
            encodePriceSqrt(99, 1000),
            expandTo18Decimals(2),
            1000,
            600
          )
        )
      })
      it('swap one for zero exact out partial', async () => {
        await snapshotGasCost(
          PriceMovementMath.getGasCostOfmovePriceTowardsTarget(
            encodePriceSqrt(1, 1),
            encodePriceSqrt(1010, 100),
            expandTo18Decimals(2),
            1000,
            600
          )
        )
      })
      it('swap zero for one exact out partial', async () => {
        await snapshotGasCost(
          PriceMovementMath.getGasCostOfmovePriceTowardsTarget(
            encodePriceSqrt(1, 1),
            encodePriceSqrt(99, 1000),
            expandTo18Decimals(2),
            1000,
            600
          )
        )
      })
    })
  })
})
