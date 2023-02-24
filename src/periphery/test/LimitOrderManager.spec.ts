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


  describe('#addLimitOrder', () => {
    it('fails if pool does not exist', async () => {
      await expect(
        lomanager.addLimitOrder({
          token0: tokens[0].address,
          token1: tokens[1].address,
          depositedToken: false,
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
            depositedToken: false,
            amount: 100,
            tick: 60
          })
      ).to.be.revertedWith('STF')
    })

    it('fails if deposited token changed during the deposit', async () => {
      let user = wallets[0]
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        encodePriceSqrt(1, 1)
      )
      await tokens[0].approve(lomanager.address, 100)

        lomanager.addLimitOrder({
            token0: tokens[0].address,
            token1: tokens[1].address,
            depositedToken: false,
            amount: 100,
            tick: 60
          })
      
      await tokens[1].approve(router.address, 1000)

      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: user.address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 110,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })

      await expect(
        lomanager.addLimitOrder({
            token0: tokens[0].address,
            token1: tokens[1].address,
            depositedToken: false,
            amount: 100,
            tick: 60
          })
      ).to.be.revertedWith('depositedToken changed')
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
        depositedToken: false,
        amount: 15,
        tick: 60
      })
      expect(await lomanager.balanceOf(wallets[0].address)).to.eq(1)
      expect(await lomanager.tokenOfOwnerByIndex(wallets[0].address, 0)).to.eq(1)
      const {
        limitPosition,
        token0,
        token1,
      } = await lomanager.limitPositions(1)
      expect(limitPosition.tick).to.eq(60)
      expect(limitPosition.liquidity).to.eq(15)
    })

    it('add second limit order to tick', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        encodePriceSqrt(1, 1)
      )
      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        depositedToken: false,
        amount: 15,
        tick: 60
      })

      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        depositedToken: false,
        amount: 15,
        tick: 60
      })
      expect(await lomanager.balanceOf(wallets[0].address)).to.eq(2)
      expect(await lomanager.tokenOfOwnerByIndex(wallets[0].address, 1)).to.eq(2)
      const {
        limitPosition,
        token0,
        token1,
      } = await lomanager.limitPositions(2)
      expect(limitPosition.tick).to.eq(60)
      expect(limitPosition.liquidity).to.eq(15)
      expect(limitPosition.liquidityInit).to.eq(15)
    })

    it('add limit order to tick with executed LO', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        encodePriceSqrt(1, 1)
      )
      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        depositedToken: false,
        amount: 15,
        tick: 60
      })

      await tokens[1].approve(router.address, 100)

      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: wallets[0].address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 20,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })

      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        depositedToken: true,
        amount: 15,
        tick: 60
      })

      expect(await lomanager.balanceOf(wallets[0].address)).to.eq(2)
      expect(await lomanager.tokenOfOwnerByIndex(wallets[0].address, 1)).to.eq(2)

      const {
        limitPosition,
        token0,
        token1,
      } = await lomanager.limitPositions(2)
      expect(limitPosition.tick).to.eq(60)
      expect(limitPosition.liquidity).to.eq(15)
      expect(limitPosition.liquidityInit).to.eq(15)
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

      const mintData = lomanager.interface.encodeFunctionData('addLimitOrder', [
        {
            token0: tokens[0].address,
            token1: tokens[1].address,
            depositedToken: false,
            amount: 100,
            tick: 60
        }
      ])

      const refundNativeTokenData = lomanager.interface.encodeFunctionData('refundNativeToken')

      const balanceBefore = await wallet.getBalance()
      let tx = await lomanager.multicall([mintData, refundNativeTokenData], {
        value: 100, // necessary so the balance doesn't change by anything that's not spent
      })
      await tx.wait();
      let pos = (await lomanager.limitPositions(1)).limitPosition
      expect(pos.tick).to.eq(60)
      expect(pos.liquidity).to.eq(100)
    })

  })

  describe('#decreaseLiquidity', () => {

    it('get all liquidity back', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        encodePriceSqrt(1, 1)
      )
      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        depositedToken: false,
        amount: 15,
        tick: 60
      })
    
      await lomanager.decreaseLimitOrder(1, 15)
      const {
        limitPosition,
        token0,
        token1,
      } = await lomanager.limitPositions(1)

      expect(limitPosition.liquidity).to.eq(0)
      expect(limitPosition.tokensOwed0).to.eq(15)
    })

    it('try to get liquidity back after lo partly executions', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        encodePriceSqrt(1, 1)
      )
      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        depositedToken: false,
        amount: 50,
        tick: 60
      })

      await tokens[1].approve(router.address, 100)

      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: wallets[0].address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 20,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })

      await lomanager.decreaseLimitOrder(1, 29)

      const {
        limitPosition,
        token0,
        token1,
      } = await lomanager.limitPositions(1)

      expect(limitPosition.liquidity).to.eq(0)
      expect(limitPosition.tokensOwed0).to.eq(29)
      expect(limitPosition.tokensOwed1).to.eq(20)
    })

    
    it('get back second LO liquidity', async () => {

      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        encodePriceSqrt(1, 1)
      )

      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        depositedToken: false,
        amount: 15,
        tick: 60
      })

      await tokens[1].approve(router.address, 100)

      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: wallets[0].address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 20,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })

      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        depositedToken: true,
        amount: 15,
        tick: 60
      })

      await lomanager.decreaseLimitOrder(2, 15)

      const {
        limitPosition,
        token0,
        token1,
      } = await lomanager.limitPositions(2)

      expect(limitPosition.liquidity).to.eq(0)
      expect(limitPosition.tokensOwed1).to.eq(15)
      
    })

    it('fails if try to get all liquidity back after lo executions', async () => {

      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        encodePriceSqrt(1, 1)
      )

      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        depositedToken: false,
        amount: 15,
        tick: 60
      })

      expect(await lomanager.balanceOf(wallets[0].address)).to.eq(1)
      expect(await lomanager.tokenOfOwnerByIndex(wallets[0].address, 0)).to.eq(1)

      await tokens[1].approve(router.address, 100)

      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: wallets[0].address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 20,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })

      await expect(lomanager.decreaseLimitOrder(1, 15)).to.be.reverted
    })

    
  })

  describe('#collectLimitOrder', () => {

    it('collect executed lo', async () => {

      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        encodePriceSqrt(1, 1)
      )

      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        depositedToken: false,
        amount: 15,
        tick: 60
      })

      await tokens[1].approve(router.address, 100)

      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: wallets[0].address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 20,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })

      await lomanager.decreaseLimitOrder(1, 0)

      let balance1Before = await tokens[1].balanceOf(wallets[0].address)
      await lomanager.collectLimitOrder(1, wallets[0].address)
      let balance1After = await tokens[1].balanceOf(wallets[0].address)
      expect(balance1After.sub(balance1Before)).to.eq(15)
    })

    it('collect partly executed lo', async () => {

      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        encodePriceSqrt(1, 1)
      )

      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        depositedToken: false,
        amount: 100,
        tick: 60
      })

      await tokens[1].approve(router.address, 100)

      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: wallets[0].address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 20,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })

      await lomanager.decreaseLimitOrder(1, 0)

      let balance0Before = await tokens[0].balanceOf(wallets[0].address)
      let balance1Before = await tokens[1].balanceOf(wallets[0].address)
      await lomanager.collectLimitOrder(1, wallets[0].address)
      let balance0After = await tokens[0].balanceOf(wallets[0].address)
      let balance1After = await tokens[1].balanceOf(wallets[0].address)
      expect(balance0After.sub(balance0Before)).to.eq(0)
      expect(balance1After.sub(balance1Before)).to.eq(20)
    
    })

    it('close & collect partly executed lo', async () => {

      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        encodePriceSqrt(1, 1)
      )

      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        depositedToken: false,
        amount: 100,
        tick: 60
      })

      await tokens[1].approve(router.address, 100)

      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: wallets[0].address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 20,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })

      await lomanager.decreaseLimitOrder(1, 79)

      let balance0Before = await tokens[0].balanceOf(wallets[0].address)
      let balance1Before = await tokens[1].balanceOf(wallets[0].address)
      await lomanager.collectLimitOrder(1, wallets[0].address)
      let balance0After = await tokens[0].balanceOf(wallets[0].address)
      let balance1After = await tokens[1].balanceOf(wallets[0].address)
      expect(balance0After.sub(balance0Before)).to.eq(79)
      expect(balance1After.sub(balance1Before)).to.eq(20)
    })

    it('close & collect lo', async () => {

      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        encodePriceSqrt(1, 1)
      )

      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        depositedToken: false,
        amount: 100,
        tick: 60
      })

      await lomanager.decreaseLimitOrder(1, 100)

      let balance0Before = await tokens[0].balanceOf(wallets[0].address)
      let balance1Before = await tokens[1].balanceOf(wallets[0].address)
      await lomanager.collectLimitOrder(1, wallets[0].address)
      let balance0After = await tokens[0].balanceOf(wallets[0].address)
      let balance1After = await tokens[1].balanceOf(wallets[0].address)
      expect(balance0After.sub(balance0Before)).to.eq(100)
      expect(balance1After.sub(balance1Before)).to.eq(0)
    })

  })

  describe('correct amounts distibution', () => {

    it('lo at positive tick', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        encodePriceSqrt(1, 1)
      )
      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        depositedToken: false,
        amount: 1000,
        tick: 6000
      })

      await tokens[1].approve(router.address, 10000)

      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: wallets[0].address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 10000,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })

      await lomanager.decreaseLimitOrder(1, 0)

      const {
        limitPosition,
        token0,
        token1,
      } = await lomanager.limitPositions(1)
      expect(limitPosition.tokensOwed0).to.eq(0)
      expect(limitPosition.tokensOwed1).to.eq(1822)
      expect(limitPosition.liquidity).to.eq(0)
    })

    it('lo at negative tick', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        encodePriceSqrt(1, 1)
      )

      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        depositedToken: true,
        amount: 1000,
        tick: -6000
      })

      await tokens[0].approve(router.address, 10000)

      await router.exactInputSingle({
        tokenIn: tokens[0].address,
        tokenOut: tokens[1].address,
        recipient: wallets[0].address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 10000,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(1, 100)
      })

      await lomanager.decreaseLimitOrder(1, 0)

      const {
        limitPosition,
        token0,
        token1,
      } = await lomanager.limitPositions(1)
      expect(limitPosition.tokensOwed1).to.eq(0)
      expect(limitPosition.tokensOwed0).to.eq(1822)
      expect(limitPosition.liquidity).to.eq(0)
    })

    it('two los at positive tick', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        encodePriceSqrt(1, 1)
      )
      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        depositedToken: false,
        amount: 1000,
        tick: 6000
      })

      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        depositedToken: false,
        amount: 1000,
        tick: 6000
      })

      await tokens[1].approve(router.address, 10000)

      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: wallets[0].address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 10000,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })

      await lomanager.decreaseLimitOrder(1, 0)
      await lomanager.decreaseLimitOrder(2, 0)
      
      let pos1 = (await lomanager.limitPositions(1)).limitPosition
      let pos2 = (await lomanager.limitPositions(2)).limitPosition
      
      expect(pos1.tokensOwed0).to.eq(0)
      expect(pos1.tokensOwed1).to.eq(1822)
      expect(pos1.liquidity).to.eq(0)

      expect(pos2.tokensOwed0).to.eq(0)
      expect(pos2.tokensOwed1).to.eq(1822)
      expect(pos2.liquidity).to.eq(0)
      
    })

    it('two los at negative tick', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        encodePriceSqrt(1, 1)
      )
      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        depositedToken: true,
        amount: 1000,
        tick: -6000
      })

      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        depositedToken: true,
        amount: 1000,
        tick: -6000
      })

      await tokens[0].approve(router.address, 10000)

      await router.exactInputSingle({
        tokenIn: tokens[0].address,
        tokenOut: tokens[1].address,
        recipient: wallets[0].address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 10000,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(1, 100)
      })

      await lomanager.decreaseLimitOrder(1, 0)
      await lomanager.decreaseLimitOrder(2, 0)

      let pos1 = (await lomanager.limitPositions(1)).limitPosition
      let pos2 = (await lomanager.limitPositions(2)).limitPosition
      
      expect(pos1.tokensOwed1).to.eq(0)
      expect(pos1.tokensOwed0).to.eq(1822)
      expect(pos1.liquidity).to.eq(0)

      expect(pos2.tokensOwed1).to.eq(0)
      expect(pos2.tokensOwed0).to.eq(1822)
      expect(pos2.liquidity).to.eq(0)
    })

    it('lo added after closed lo at negative tick', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        encodePriceSqrt(1, 1)
      )
      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        depositedToken: true,
        amount: 1000,
        tick: -6000
      })

      await tokens[0].approve(router.address, 10000)
      await tokens[1].approve(router.address, 10000)

      await router.exactInputSingle({
        tokenIn: tokens[0].address,
        tokenOut: tokens[1].address,
        recipient: wallets[0].address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 10000,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(1, 100)
      })

      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        depositedToken: false,
        amount: 1000,
        tick: -6000
      })

      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: wallets[0].address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 10000,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })

      await lomanager.decreaseLimitOrder(1, 0)
      await lomanager.decreaseLimitOrder(2, 0)

      let pos1 = (await lomanager.limitPositions(1)).limitPosition
      let pos2 = (await lomanager.limitPositions(2)).limitPosition
      
      expect(pos1.tokensOwed1).to.eq(0)
      expect(pos1.tokensOwed0).to.eq(1822)
      expect(pos1.liquidity).to.eq(0)

      expect(pos2.tokensOwed1).to.eq(548)
      expect(pos2.tokensOwed0).to.eq(0)
      expect(pos2.liquidity).to.eq(0)
    })

    it('lo added after closed lo at positive tick', async () => {

      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        encodePriceSqrt(1, 1)
      )

      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        depositedToken: false,
        amount: 1000,
        tick: 6000
      })
      
      await tokens[0].approve(router.address, 10000)
      await tokens[1].approve(router.address, 10000)

      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: wallets[0].address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 10000,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })

      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        depositedToken: true,
        amount: 1000,
        tick: 6000
      })

      await router.exactInputSingle({
        tokenIn: tokens[0].address,
        tokenOut: tokens[1].address,
        recipient: wallets[0].address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 1000,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(1, 100)
      })

      await lomanager.decreaseLimitOrder(1, 0)
      await lomanager.decreaseLimitOrder(2, 0)


      let pos1 = (await lomanager.limitPositions(1)).limitPosition
      let pos2 = (await lomanager.limitPositions(2)).limitPosition
      
      expect(pos1.tokensOwed1).to.eq(1822)
      expect(pos1.tokensOwed0).to.eq(0)
      expect(pos1.liquidity).to.eq(0)

      expect(pos2.tokensOwed1).to.eq(0)
      expect(pos2.tokensOwed0).to.eq(548)
      expect(pos2.liquidity).to.eq(0)

    })

    it('placed at tick with partly executed lo', async () => {
      let user = wallets[0]
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        encodePriceSqrt(1, 1)
      )
      await tokens[0].approve(lomanager.address, 1000)
        lomanager.addLimitOrder({
            token0: tokens[0].address,
            token1: tokens[1].address,
            depositedToken: false,
            amount: 200,
            tick: 60
          })
      
      await tokens[1].approve(router.address, 1000)
      
      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: user.address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 100,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })
      await lomanager.decreaseLimitOrder(1, 0)

      await lomanager.addLimitOrder({
            token0: tokens[0].address,
            token1: tokens[1].address,
            depositedToken: false,
            amount: 100,
            tick: 60
      })

      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: user.address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 100,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })

      await lomanager.decreaseLimitOrder(1, 0)
      await lomanager.decreaseLimitOrder(2, 0)

      let pos1 = (await lomanager.limitPositions(1)).limitPosition
      let pos2 = (await lomanager.limitPositions(2)).limitPosition
      
      expect(pos1.tokensOwed1).to.eq(150)
      expect(pos1.tokensOwed0).to.eq(0)
      expect(pos1.liquidity).to.eq(49)

      expect(pos2.tokensOwed1).to.eq(50)
      expect(pos2.tokensOwed0).to.eq(0)
      expect(pos2.liquidity).to.eq(49)

      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: user.address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 100,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })
      
      await lomanager.decreaseLimitOrder(1, 0)
      await lomanager.decreaseLimitOrder(2, 0)

      pos1 = (await lomanager.limitPositions(1)).limitPosition
      pos2 = (await lomanager.limitPositions(2)).limitPosition
      
      expect(pos1.tokensOwed1).to.eq(199)
      expect(pos1.tokensOwed0).to.eq(0)
      expect(pos1.liquidity).to.eq(0)

      expect(pos2.tokensOwed1).to.eq(99)
      expect(pos2.tokensOwed0).to.eq(0)
      expect(pos2.liquidity).to.eq(0)

    })

    it('placed at tick with partly executed lo', async () => {
      let user = wallets[0]
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        encodePriceSqrt(1, 1)
      )
      await tokens[0].approve(lomanager.address, 1000)
        lomanager.addLimitOrder({
            token0: tokens[0].address,
            token1: tokens[1].address,
            depositedToken: false,
            amount: 200,
            tick: 60
          })
      
      await tokens[1].approve(router.address, 1000)
      
      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: user.address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 100,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })
  
      await lomanager.addLimitOrder({
            token0: tokens[0].address,
            token1: tokens[1].address,
            depositedToken: false,
            amount: 100,
            tick: 60
      })
  
      await lomanager.decreaseLimitOrder(1, 99)
  
      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: user.address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 50,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })
  
      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        depositedToken: false,
        amount: 100,
        tick: 60
      })
  
      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: user.address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 150,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })
  
      await lomanager.decreaseLimitOrder(1, 0)
      await lomanager.decreaseLimitOrder(2, 0)
      await lomanager.decreaseLimitOrder(3, 0)
  
      let pos1 = (await lomanager.limitPositions(1)).limitPosition
      let pos2 = (await lomanager.limitPositions(2)).limitPosition
      let pos3 = (await lomanager.limitPositions(3)).limitPosition
      
      expect(pos1.tokensOwed1).to.eq(100)
      expect(pos1.tokensOwed0).to.eq(99)
      expect(pos1.liquidity).to.eq(0)
  
      expect(pos2.tokensOwed1).to.eq(99)
      expect(pos2.tokensOwed0).to.eq(0)
      expect(pos2.liquidity).to.eq(0)
  
      expect(pos3.tokensOwed1).to.eq(100)
      expect(pos3.tokensOwed0).to.eq(0)
      expect(pos3.liquidity).to.eq(0)
  
    })
  
    it('placed at tick with partly executed lo', async () => {
      let user = wallets[0]
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        encodePriceSqrt(1, 1)
      )
      await tokens[0].approve(lomanager.address, 1000)
        lomanager.addLimitOrder({
            token0: tokens[0].address,
            token1: tokens[1].address,
            depositedToken: false,
            amount: 100,
            tick: 60
          })
  
      await lomanager.addLimitOrder({
            token0: tokens[0].address,
            token1: tokens[1].address,
            depositedToken: false,
            amount: 100,
            tick: 60
      })
      
      await tokens[1].approve(router.address, 1000)
      
      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: user.address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 100,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })
  
      await lomanager.decreaseLimitOrder(1, 49)
  
      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: user.address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 25,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })
  
  
      await lomanager.decreaseLimitOrder(1, 0)
      await lomanager.decreaseLimitOrder(2, 0)
  
      let pos1 = (await lomanager.limitPositions(1)).limitPosition
      let pos2 = (await lomanager.limitPositions(2)).limitPosition
      
      expect(pos1.tokensOwed1).to.eq(50)
      expect(pos1.tokensOwed0).to.eq(49)
      expect(pos1.liquidity).to.eq(0)
  
      expect(pos2.tokensOwed1).to.eq(74)
      expect(pos2.tokensOwed0).to.eq(0)
      expect(pos2.liquidity).to.eq(25)
  
    })

    it('3 LOs with different deposited tokens', async () => {
      let user = wallets[0]

      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        encodePriceSqrt(1, 1)
      )

      await tokens[0].approve(lomanager.address, 1000)
      lomanager.addLimitOrder({
            token0: tokens[0].address,
            token1: tokens[1].address,
            depositedToken: false,
            amount: 100,
            tick: 60
      })
      
      await tokens[1].approve(router.address, 1000)
      await tokens[0].approve(router.address, 1000)

      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: user.address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 101,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })
  
      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        depositedToken: true,
        amount: 100,
        tick: 60
      })

      await router.exactInputSingle({
        tokenIn: tokens[0].address,
        tokenOut: tokens[1].address,
        recipient: user.address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 101,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(1, 100)
      })
  
      lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        depositedToken: false,
        amount: 100,
        tick: 60
      })

      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: user.address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 101,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })
  
      await lomanager.decreaseLimitOrder(1, 0)
      await lomanager.decreaseLimitOrder(2, 0)
      await lomanager.decreaseLimitOrder(3, 0)
  
      let pos1 = (await lomanager.limitPositions(1)).limitPosition
      let pos2 = (await lomanager.limitPositions(2)).limitPosition
      let pos3 = (await lomanager.limitPositions(3)).limitPosition
      
      expect(pos1.tokensOwed1).to.eq(100)
      expect(pos1.tokensOwed0).to.eq(0)
      expect(pos1.liquidity).to.eq(0)
  
      expect(pos2.tokensOwed1).to.eq(0)
      expect(pos2.tokensOwed0).to.eq(99)
      expect(pos2.liquidity).to.eq(0)

      expect(pos3.tokensOwed1).to.eq(100)
      expect(pos3.tokensOwed0).to.eq(0)
      expect(pos3.liquidity).to.eq(0)
  
    })

    it('placed at tick with partly executed lo', async () => {
      let user = wallets[0]
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        encodePriceSqrt(1, 1)
      )
      await tokens[0].approve(lomanager.address, 1000)
        lomanager.addLimitOrder({
            token0: tokens[0].address,
            token1: tokens[1].address,
            depositedToken: false,
            amount: 200,
            tick: 60
          })
      
      await tokens[1].approve(router.address, 1000)
      
      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: user.address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 100,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })
  
      await lomanager.addLimitOrder({
            token0: tokens[0].address,
            token1: tokens[1].address,
            depositedToken: false,
            amount: 100,
            tick: 60
      })
  
      await lomanager.decreaseLimitOrder(1, 99)
  
      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: user.address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 50,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })
  
      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        depositedToken: false,
        amount: 100,
        tick: 60
      })
  
      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: user.address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 100,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })

      await lomanager.decreaseLimitOrder(3, 33)

      await lomanager.addLimitOrder({
        token0: tokens[0].address,
        token1: tokens[1].address,
        depositedToken: false,
        amount: 100,
        tick: 60
      })

      await router.exactInputSingle({
        tokenIn: tokens[1].address,
        tokenOut: tokens[0].address,
        recipient: user.address,
        deadline: encodePriceSqrt(2, 1),
        amountIn: 100,
        amountOutMinimum: 0,
        limitSqrtPrice: encodePriceSqrt(100, 1)
      })
  
      await lomanager.decreaseLimitOrder(1, 0)
      await lomanager.decreaseLimitOrder(2, 0)
      await lomanager.decreaseLimitOrder(3, 0)
      await lomanager.decreaseLimitOrder(4, 0)
  
      let pos1 = (await lomanager.limitPositions(1)).limitPosition
      let pos2 = (await lomanager.limitPositions(2)).limitPosition
      let pos3 = (await lomanager.limitPositions(3)).limitPosition
      let pos4 = (await lomanager.limitPositions(4)).limitPosition
      
      expect(pos1.tokensOwed1).to.eq(100)
      expect(pos1.tokensOwed0).to.eq(99)
      expect(pos1.liquidity).to.eq(0)
  
      expect(pos2.tokensOwed1).to.eq(96)
      expect(pos2.tokensOwed0).to.eq(0)
      expect(pos2.liquidity).to.eq(3)
  
      expect(pos3.tokensOwed1).to.eq(66)
      expect(pos3.tokensOwed0).to.eq(33)
      expect(pos3.liquidity).to.eq(0)

      expect(pos4.tokensOwed1).to.eq(86)
      expect(pos4.tokensOwed0).to.eq(0)
      expect(pos4.liquidity).to.eq(13)
  
    })
  })

})
