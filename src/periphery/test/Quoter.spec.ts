import { Fixture } from 'ethereum-waffle'
import { constants, Wallet, ContractTransaction } from 'ethers'
import { ethers, waffle } from 'hardhat'
import { IWNativeToken, MockTimeNonfungiblePositionManager, MockTimeSwapRouter, Quoter, TestERC20 } from '../typechain'
import completeFixture from './shared/completeFixture'
import { FeeAmount, MaxUint128, TICK_SPACINGS } from './shared/constants'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { expandTo18Decimals } from './shared/expandTo18Decimals'
import { expect } from './shared/expect'
import { encodePath } from './shared/path'
import { createPool } from './shared/quoter'
import { MockProvider } from 'ethereum-waffle'

describe('Quoter', () => {
  let wallet: Wallet
  let trader: Wallet

  const swapRouterFixture: Fixture<{
    nft: MockTimeNonfungiblePositionManager
    tokens: [TestERC20, TestERC20, TestERC20]
    quoter: Quoter,
    provider: MockProvider,
    router: MockTimeSwapRouter,
    wnative: IWNativeToken,
  }> = async (wallets, provider) => {
    const { wnative, factory, router, tokens, nft } = await completeFixture(wallets, provider)

    // approve & fund wallets
    for (const token of tokens) {
      await token.approve(router.address, constants.MaxUint256)
      await token.approve(nft.address, constants.MaxUint256)
      await token.connect(trader).approve(router.address, constants.MaxUint256)
      await token.transfer(trader.address, expandTo18Decimals(1_000_000))
    }

    const quoterFactory = await ethers.getContractFactory('Quoter')
    quoter = (await quoterFactory.deploy(factory.address, wnative.address, await factory.poolDeployer())) as Quoter

    return {
      tokens,
      nft,
      quoter,
      provider,
      router,
      wnative
    }
  }

  let nft: MockTimeNonfungiblePositionManager
  let tokens: [TestERC20, TestERC20, TestERC20]
  let quoter: Quoter
  let provider: MockProvider
  let router: MockTimeSwapRouter
  let wnative: IWNativeToken

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    const wallets = await (ethers as any).getSigners()
    ;[wallet, trader] = wallets
    loadFixture = waffle.createFixtureLoader(wallets)
  })

  // helper for getting wnative and token balances
  beforeEach('load fixture', async () => {
    ;({ tokens, nft, quoter, provider, router, wnative} = await loadFixture(swapRouterFixture))
  })

  describe('quotes', () => {
    beforeEach(async () => {
      await createPool(nft, wallet, tokens[0].address, tokens[1].address)
      await createPool(nft, wallet, tokens[1].address, tokens[2].address)
    })

    describe('#quoteExactInput', () => {
      it('0 -> 1', async () => {
        const {amountOut, fees} = await quoter.callStatic.quoteExactInput(
          encodePath([tokens[0].address, tokens[1].address]),
          3
        )

        expect(amountOut).to.eq(1)
        expect(fees[0]).to.eq(100)
      })

      it('0 -> 1 changes fee', async () => {
        async function exactInput(
          tokens: string[],
          amountIn: number = 3,
          amountOutMinimum: number = 1
        ): Promise<ContractTransaction> {
          const inputIsWNativeToken = wnative.address === tokens[0]
          const outputIsWNativeToken = tokens[tokens.length - 1] === wnative.address
  
          const value = inputIsWNativeToken ? amountIn : 0
  
          const params = {
            path: encodePath(tokens),
            recipient: outputIsWNativeToken ? constants.AddressZero : trader.address,
            deadline: 1,
            amountIn: expandTo18Decimals(amountIn),
            amountOutMinimum: 0
          }
  
          const data = [router.interface.encodeFunctionData('exactInput', [params])]
          if (outputIsWNativeToken)
            data.push(router.interface.encodeFunctionData('unwrapWNativeToken', [amountOutMinimum, trader.address]))
  
  
          // optimized for the gas test
          return data.length === 1
            ? router.connect(trader).exactInput(params, { value })
            : router.connect(trader).multicall(data, { value })
        }

        const {amountOut, fees} = await quoter.callStatic.quoteExactInput(
          encodePath([tokens[0].address, tokens[1].address]),
          expandTo18Decimals(300000)
        )
        
        expect(fees[0]).to.eq(100)

        await exactInput([tokens[0].address, tokens[1].address], 300000)

        await provider.send('evm_mine', [])
        await provider.send('evm_increaseTime', [60*60*2])
        
        const {amountOut: amountOut2, fees: fees2} = await quoter.callStatic.quoteExactInput(
          encodePath([tokens[0].address, tokens[1].address]),
          expandTo18Decimals(300000)
        )
        
        expect(fees2[0]).to.eq(15000)
      })

      it('1 -> 0', async () => {
        const {amountOut, fees} = await quoter.callStatic.quoteExactInput(
          encodePath([tokens[1].address, tokens[0].address]),
          3
        )

        expect(amountOut).to.eq(1)
        expect(fees[0]).to.eq(100)
      })

      it('0 -> 1 -> 2', async () => {
        const {amountOut, fees} = await quoter.callStatic.quoteExactInput(
          encodePath(
            tokens.map((token) => token.address)
          ),
          5
        )

        expect(amountOut).to.eq(1)
        expect(fees[0]).to.eq(100)
      })

      it('2 -> 1 -> 0', async () => {
        const {amountOut, fees} = await quoter.callStatic.quoteExactInput(
          encodePath(tokens.map((token) => token.address).reverse()),
          5
        )

        expect(amountOut).to.eq(1)
        expect(fees[0]).to.eq(100)
      })
    })

    describe('#quoteExactInputSingle', () => {
      it('0 -> 1', async () => {
        const {amountOut, fee} = await quoter.callStatic.quoteExactInputSingle(
          tokens[0].address,
          tokens[1].address,
          MaxUint128,
          // -2%
          encodePriceSqrt(100, 102)
        )

        expect(amountOut).to.eq(9852)
        expect(fee).to.eq(100)
      })

      it('1 -> 0', async () => {
        const {amountOut, fee} = await quoter.callStatic.quoteExactInputSingle(
          tokens[1].address,
          tokens[0].address,
          MaxUint128,
          // +2%
          encodePriceSqrt(102, 100)
        )

        expect(amountOut).to.eq(9852)
        expect(fee).to.eq(100)
      })
    })

    describe('#quoteExactOutput', () => {
      it('0 -> 1', async () => {
        const {amountIn, fees} = await quoter.callStatic.quoteExactOutput(
          encodePath([tokens[1].address, tokens[0].address]),
          1
        )

        expect(amountIn).to.eq(3)
        expect(fees[0]).to.eq(100)
      })

      it('1 -> 0', async () => {
        const {amountIn, fees} = await quoter.callStatic.quoteExactOutput(
          encodePath([tokens[0].address, tokens[1].address]),
          1
        )

        expect(amountIn).to.eq(3)
        expect(fees[0]).to.eq(100)
      })

      it('0 -> 1 -> 2', async () => {
        const {amountIn, fees} = await quoter.callStatic.quoteExactOutput(
          encodePath(tokens.map((token) => token.address).reverse()),
          1
        )

        expect(amountIn).to.eq(5)
        expect(fees[0]).to.eq(100)
      })

      it('2 -> 1 -> 0', async () => {
        const {amountIn, fees} = await quoter.callStatic.quoteExactOutput(
          encodePath(
            tokens.map((token) => token.address)
          ),
          1
        )

        expect(amountIn).to.eq(5)
        expect(fees[0]).to.eq(100)
      })
    })

    describe('#quoteExactOutputSingle', () => {
      it('0 -> 1', async () => {
        const {amountIn, fee} = await quoter.callStatic.quoteExactOutputSingle(
          tokens[0].address,
          tokens[1].address,
          MaxUint128,
          encodePriceSqrt(100, 102)
        )

        expect(amountIn).to.eq(9952)
        expect(fee).to.eq(100)
      })

      it('1 -> 0', async () => {
        const {amountIn, fee} = await quoter.callStatic.quoteExactOutputSingle(
          tokens[1].address,
          tokens[0].address,
          MaxUint128,
          encodePriceSqrt(102, 100)
        )

        expect(amountIn).to.eq(9952)
        expect(fee).to.eq(100)
      })
    })
  })
})
