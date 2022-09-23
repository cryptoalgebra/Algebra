import { BigNumber, BigNumberish, constants, Contract, ContractTransaction, Wallet } from 'ethers'
import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { MockTimeNonfungiblePositionManager, TestERC20, TickLensTest } from '../typechain'
import completeFixture from './shared/completeFixture'
import { FeeAmount, TICK_SPACINGS } from './shared/constants'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { expect } from './shared/expect'
import { getMaxTick, getMinTick } from './shared/ticks'
import { computePoolAddress } from './shared/computePoolAddress'
import snapshotGasCost from './shared/snapshotGasCost'

describe('TickLens', () => {
  let wallets: Wallet[]

  const nftFixture: () => Promise<{
    factory: Contract
    nft: MockTimeNonfungiblePositionManager
    tokens: [TestERC20, TestERC20, TestERC20]
  }> = async () => {
    const { factory, tokens, nft } = await completeFixture()

    for (const token of tokens) {
      await token.approve(nft.address, constants.MaxUint256)
    }

    return {
      factory,
      nft,
      tokens,
    }
  }

  let factory: Contract
  let nft: MockTimeNonfungiblePositionManager
  let tokens: [TestERC20, TestERC20, TestERC20]
  let poolAddress: string
  let tickLens: TickLensTest


  before('create fixture loader', async () => {
    wallets = await (ethers as any).getSigners()
  })

  beforeEach('load fixture', async () => {
    ;({ factory, tokens, nft } = await loadFixture(nftFixture))
  })

  describe('#getPopulatedTicksInWord', () => {
    const fullRangeLiquidity = 1000000
    async function createPool(tokenAddressA: string, tokenAddressB: string) {
      if (tokenAddressA.toLowerCase() > tokenAddressB.toLowerCase())
        [tokenAddressA, tokenAddressB] = [tokenAddressB, tokenAddressA]

      await nft.createAndInitializePoolIfNecessary(
        tokenAddressA,
        tokenAddressB,
        encodePriceSqrt(1, 1)
      )

      const liquidityParams = {
        token0: tokenAddressA,
        token1: tokenAddressB,
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallets[0].address,
        amount0Desired: 1000000,
        amount1Desired: 1000000,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      }

      return nft.mint(liquidityParams)
    }

    async function mint(tickLower: number, tickUpper: number, amountBothDesired: BigNumberish): Promise<number> {
      const mintParams = {
        token0: tokens[0].address,
        token1: tokens[1].address,
        fee: FeeAmount.MEDIUM,
        tickLower,
        tickUpper,
        amount0Desired: amountBothDesired,
        amount1Desired: amountBothDesired,
        amount0Min: 0,
        amount1Min: 0,
        recipient: wallets[0].address,
        deadline: 1,
      }

      const { liquidity } = await nft.callStatic.mint(mintParams)

      await nft.mint(mintParams)
      return liquidity.toNumber()
    }

    beforeEach(async () => {
      await createPool(tokens[0].address, tokens[1].address)
      poolAddress = computePoolAddress(await factory.poolDeployer(), [tokens[0].address, tokens[1].address])
    })

    beforeEach(async () => {
      const lensFactory = await ethers.getContractFactory('TickLensTest')
      tickLens = (await lensFactory.deploy()) as TickLensTest
    })

    function getTickTableIndex(tick: BigNumberish, tickSpacing: number): BigNumber {
      const intermediate = BigNumber.from(tick).div(tickSpacing)
      // see https://docs.soliditylang.org/en/v0.7.6/types.html#shifts
      return intermediate.lt(0) ? intermediate.add(1).div(BigNumber.from(2).pow(8)).sub(1) : intermediate.shr(8)
    }

    it('works for min/max', async () => {
      const [min] = await tickLens.getPopulatedTicksInWord(
        poolAddress,
        getTickTableIndex(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]), TICK_SPACINGS[FeeAmount.MEDIUM])
      )

      const [max] = await tickLens.getPopulatedTicksInWord(
        poolAddress,
        getTickTableIndex(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]), TICK_SPACINGS[FeeAmount.MEDIUM])
      )

      expect(min.tick).to.be.eq(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]))
      expect(min.liquidityNet).to.be.eq(fullRangeLiquidity)
      expect(min.liquidityGross).to.be.eq(fullRangeLiquidity)

      expect(max.tick).to.be.eq(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]))
      expect(max.liquidityNet).to.be.eq(fullRangeLiquidity * -1)
      expect(min.liquidityGross).to.be.eq(fullRangeLiquidity)
    })

    it('works for min/max and -2/-1/0/1', async () => {
      const minus = -TICK_SPACINGS[FeeAmount.MEDIUM]
      const plus = -minus

      const liquidity0 = await mint(minus * 2, minus, 2)
      const liquidity1 = await mint(minus * 2, 0, 3)
      const liquidity2 = await mint(minus * 2, plus, 5)
      const liquidity3 = await mint(minus, 0, 7)
      const liquidity4 = await mint(minus, plus, 11)
      const liquidity5 = await mint(0, plus, 13)

      const [min] = await tickLens.getPopulatedTicksInWord(
        poolAddress,
        getTickTableIndex(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]), TICK_SPACINGS[FeeAmount.MEDIUM])
      )

      const [negativeOne, negativeTwo] = await tickLens.getPopulatedTicksInWord(
        poolAddress,
        getTickTableIndex(minus, TICK_SPACINGS[FeeAmount.MEDIUM])
      )

      const [one, zero] = await tickLens.getPopulatedTicksInWord(
        poolAddress,
        getTickTableIndex(plus, TICK_SPACINGS[FeeAmount.MEDIUM])
      )

      const [max] = await tickLens.getPopulatedTicksInWord(
        poolAddress,
        getTickTableIndex(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]), TICK_SPACINGS[FeeAmount.MEDIUM])
      )

      expect(min.tick).to.be.eq(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]))
      expect(min.liquidityNet).to.be.eq(fullRangeLiquidity)
      expect(min.liquidityGross).to.be.eq(fullRangeLiquidity)

      expect(negativeTwo.tick).to.be.eq(minus * 2)
      expect(negativeTwo.liquidityNet).to.be.eq(liquidity0 + liquidity1 + liquidity2)
      expect(negativeTwo.liquidityGross).to.be.eq(liquidity0 + liquidity1 + liquidity2)

      expect(negativeOne.tick).to.be.eq(minus)
      expect(negativeOne.liquidityNet).to.be.eq(liquidity3 + liquidity4 - liquidity0)
      expect(negativeOne.liquidityGross).to.be.eq(liquidity3 + liquidity4 + liquidity0)

      expect(zero.tick).to.be.eq(0)
      expect(zero.liquidityNet).to.be.eq(liquidity5 - liquidity1 - liquidity3)
      expect(zero.liquidityGross).to.be.eq(liquidity5 + liquidity1 + liquidity3)

      expect(one.tick).to.be.eq(plus)
      expect(one.liquidityNet).to.be.eq(-liquidity2 - liquidity4 - liquidity5)
      expect(one.liquidityGross).to.be.eq(liquidity2 + liquidity4 + liquidity5)

      expect(max.tick).to.be.eq(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]))
      expect(max.liquidityNet).to.be.eq(fullRangeLiquidity * -1)
      expect(max.liquidityGross).to.be.eq(fullRangeLiquidity)
    })

    it('gas for single populated tick [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(
        tickLens.getGasCostOfGetPopulatedTicksInWord(
          poolAddress,
          getTickTableIndex(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]), TICK_SPACINGS[FeeAmount.MEDIUM])
        )
      )
    })

    it('fully populated ticks [ @skip-on-coverage ]', async () => {
      // fully populate a word
      for (let i = 0; i < 128; i++) {
        await mint(i * TICK_SPACINGS[FeeAmount.MEDIUM], (255 - i) * TICK_SPACINGS[FeeAmount.MEDIUM], 100)
      }

      const ticks = await tickLens.getPopulatedTicksInWord(
        poolAddress,
        getTickTableIndex(0, TICK_SPACINGS[FeeAmount.MEDIUM])
      )
      expect(ticks.length).to.be.eq(256)

      await snapshotGasCost(
        tickLens.getGasCostOfGetPopulatedTicksInWord(
          poolAddress,
          getTickTableIndex(0, TICK_SPACINGS[FeeAmount.MEDIUM])
        )
      )
    }).timeout(300_000)
  })
})
