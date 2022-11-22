import { constants, Wallet, BigNumber } from 'ethers'
import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import {
  MockTimeNonfungiblePositionManager,
  PoolAddressTest,
  TestERC20,
  IWNativeToken,
  IAlgebraFactory,
  SwapRouter,
  LimitOrderManager,
  IAlgebraPool
} from '../typechain'
import completeFixture from './shared/completeFixture'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { expect } from './shared/expect'
import { expandTo18Decimals } from './shared/expandTo18Decimals'
import { sortedTokens } from './shared/tokenSort'


import { abi as IAlgebraPoolABI } from '@cryptoalgebra/core/artifacts/contracts/interfaces/IAlgebraPool.sol/IAlgebraPool.json'
import { token } from '../typechain/@openzeppelin/contracts'

describe('LimitOrderManager', () => {
  let wallets: Wallet[]
  let wallet: Wallet, other: Wallet

  const loFixture: () => Promise<{
    nft: MockTimeNonfungiblePositionManager
    factory: IAlgebraFactory
    tokens: [TestERC20, TestERC20, TestERC20]
    wnative: IWNativeToken
    router: SwapRouter
    lomanager: LimitOrderManager
  }> = async () => {
    const { wnative, factory, tokens, nft, router, lomanager} = await completeFixture()

    // approve & fund wallets
    for (const token of tokens) {
      await token.approve(lomanager.address, constants.MaxUint256)
      await token.connect(other).approve(lomanager.address, constants.MaxUint256)
      await token.transfer(other.address, expandTo18Decimals(1_000_000))
    }

    return {
      nft,
      factory,
      tokens,
      wnative,
      router,
      lomanager
    }
  }

  let poolAddress: PoolAddressTest
  let factory: IAlgebraFactory
  let nft: MockTimeNonfungiblePositionManager
  let tokens: [TestERC20, TestERC20, TestERC20]
  let wnative: IWNativeToken
  let router: SwapRouter
  let lomanager: LimitOrderManager

  before('create fixture loader', async () => {
    wallets = await (ethers as any).getSigners()
    ;[wallet, other] = wallets
  })

  beforeEach('load fixture', async () => {
    ;({ nft, factory, tokens, wnative, router, lomanager } = await loadFixture(loFixture))
  })


  describe.only('#mint', () => {
    it('fails if pool does not exist', async () => {
      await expect(
        lomanager.addLimitOrder({
          token0: tokens[0].address,
          token1: tokens[1].address,
          amount: 100,
          tick: 60
        })
      ).to.be.reverted
    })

    it('fails if cannot transfer', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        encodePriceSqrt(1, 1)
      )
      await tokens[0].approve(lomanager.address, 0)
      await expect(
        lomanager.addLimitOrder({
            token0: tokens[0].address,
            token1: tokens[1].address,
            amount: 100,
            tick: 60
          })
      ).to.be.revertedWith('STF')
    })

    it('creates a token', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        encodePriceSqrt(1, 1)
      )
      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        amount: 15,
        tick: 60
      })
      expect(await lomanager.balanceOf(wallets[0].address)).to.eq(1)
      expect(await lomanager.tokenOfOwnerByIndex(wallets[0].address, 0)).to.eq(1)
      const {
        nonce,
        operator,
        token0,
        token1,
        liquidity,
        tick,
        feeGrowthInside0LastX128,
        feeGrowthInside1LastX128,
        tokensOwed0,
        tokensOwed1
      } = await lomanager.limitPositions(1)
      expect(tick).to.eq(60)
      expect(liquidity).to.eq(15)
    })

    it('can use eth via multicall', async () => {
      const [token0, token1] = sortedTokens(wnative, tokens[0])

      // remove any approval
      await wnative.approve(nft.address, 0)

      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        encodePriceSqrt(1, 1)
      )

      console.log(encodePriceSqrt(1,1));

      const mintData = lomanager.interface.encodeFunctionData('addLimitOrder', [
        {
            token0: tokens[0].address,
            token1: tokens[1].address,
            amount: 15,
            tick: 60
        }
      ])

      const refundNativeTokenData = lomanager.interface.encodeFunctionData('refundNativeToken')

      const balanceBefore = await wallet.getBalance()
      let tx = await lomanager.multicall([mintData, refundNativeTokenData], {
        value: expandTo18Decimals(1), // necessary so the balance doesn't change by anything that's not spent
      })
      let rcpt = await tx.wait();
      const balanceAfter = await wallet.getBalance()
      let gasPrice = tx.gasPrice || BigNumber.from(0);
      expect(balanceBefore.sub(balanceAfter).sub(gasPrice.mul(rcpt.gasUsed))).to.eq(100)
    })
    
    it('mint and decrease pos', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        encodePriceSqrt(1, 1)
      )
      let balanceBefore = await tokens[0].balanceOf(wallets[0].address)
      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        amount: 15,
        tick: 60
      })
      let balanceAfter = await  tokens[0].balanceOf(wallets[0].address)
      console.log(balanceAfter.sub(balanceBefore))
      expect(await lomanager.balanceOf(wallets[0].address)).to.eq(1)
      expect(await lomanager.tokenOfOwnerByIndex(wallets[0].address, 0)).to.eq(1)
      const {
        nonce,
        operator,
        token0,
        token1,
        liquidity,
        tick,
        feeGrowthInside0LastX128,
        feeGrowthInside1LastX128,
        tokensOwed0,
        tokensOwed1
      } = await lomanager.limitPositions(1)
      expect(tick).to.eq(60)
      expect(liquidity).to.eq(15)
      balanceBefore = await tokens[0].balanceOf(wallets[0].address)
      let amounts = await lomanager.decreaseLimitOrder(1,15)
      await lomanager.collectLimitOrder(1,wallets[0].address)
      balanceAfter = await  tokens[0].balanceOf(wallets[0].address)
      console.log(balanceAfter.sub(balanceBefore))
    })

    it('mint and decrease pos', async () => {
      let user = wallets[0].address
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        encodePriceSqrt(1, 1)
      )
      let balanceBefore = await tokens[0].balanceOf(user)
      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        amount: 15,
        tick: 60
      })
      let balanceAfter = await  tokens[0].balanceOf(user)
      console.log(balanceAfter.sub(balanceBefore))
      await tokens[1].approve(router.address, 100)

      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: user,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 10,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })

      balanceBefore = await tokens[1].balanceOf(user)
      let amounts = await lomanager.decreaseLimitOrder(1,0)
      const {
        nonce,
        operator,
        token0,
        token1,
        liquidity,
        tick,
        feeGrowthInside0LastX128,
        feeGrowthInside1LastX128,
        tokensOwed0,
        tokensOwed1
      } = await lomanager.limitPositions(1)
      console.log(":",liquidity,tokensOwed0,tokensOwed1)
      await lomanager.collectLimitOrder(1, user)
      balanceAfter = await  tokens[1].balanceOf(user)
      console.log(balanceAfter.sub(balanceBefore))
    })

    it.only('mint and decrease pos for 2 users', async () => {
      let user = wallets[0].address
      let user2 = wallets[1]

      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        encodePriceSqrt(1, 1)
      )
      //
      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        amount: 100,
        tick: 60
      })
      await tokens[1].approve(router.address, 1000)
      await tokens[0].connect(user2).approve(lomanager.address,10000)

      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: user,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 50,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })



      let balanceBefore = await tokens[1].balanceOf(user)
      let amounts = await lomanager.decreaseLimitOrder(1,0)

      await lomanager.connect(user2).addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        amount: 100,
        tick: 60
      })

      
      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: user,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 1000,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })

      amounts = await lomanager.decreaseLimitOrder(1,0)
      amounts = await lomanager.connect(user2).decreaseLimitOrder(2,0)

      const {
        nonce,
        operator,
        token0,
        token1,
        liquidity,
        tick,
        feeGrowthInside0LastX128,
        feeGrowthInside1LastX128,
        tokensOwed0,
        tokensOwed1
      } = await lomanager.limitPositions(2)

      console.log("stats:",liquidity,tokensOwed0,tokensOwed1)
      
    })
  })


})
