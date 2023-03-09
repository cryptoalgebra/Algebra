import { BigNumber, constants, Contract, ContractTransaction, Wallet } from 'ethers'
import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { IWNativeToken, MockTimeNonfungiblePositionManager, MockTimeSwapRouter, TestERC20 } from '../typechain'
import completeFixture from './shared/completeFixture'
import { FeeAmount, TICK_SPACINGS } from './shared/constants'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { expandTo18Decimals } from './shared/expandTo18Decimals'
import { expect } from './shared/expect'
import { encodePath } from './shared/path'
import { getMaxTick, getMinTick } from './shared/ticks'
import { computePoolAddress } from './shared/computePoolAddress'

describe('SwapRouter', function () {
  this.timeout(40000)
  let wallet: Wallet
  let trader: Wallet

  const swapRouterFixture: () => Promise<{
    wnative: IWNativeToken
    factory: Contract
    router: MockTimeSwapRouter
    nft: MockTimeNonfungiblePositionManager
    tokens: [TestERC20, TestERC20, TestERC20]
  }> = async () => {
    const { wnative, factory, router, tokens, nft } = await completeFixture()

    // approve & fund wallets
    for (const token of tokens) {
      await token.approve(router.address, constants.MaxUint256)
      await token.approve(nft.address, constants.MaxUint256)
      await token.connect(trader).approve(router.address, constants.MaxUint256)
      await token.transfer(trader.address, expandTo18Decimals(1_000_000))
    }

    return {
      wnative,
      factory,
      router,
      tokens,
      nft,
    }
  }

  let factory: Contract
  let wnative: IWNativeToken
  let router: MockTimeSwapRouter
  let nft: MockTimeNonfungiblePositionManager
  let tokens: [TestERC20, TestERC20, TestERC20]
  let getBalances: (
    who: string
  ) => Promise<{
    wnative: BigNumber
    token0: BigNumber
    token1: BigNumber
    token2: BigNumber
  }>


  before('create fixture loader', async () => {
    ;[wallet, trader] = await (ethers as any).getSigners()
  })

  // helper for getting wnative and token balances
  beforeEach('load fixture', async () => {
    ;({ router, wnative, factory, tokens, nft } = await loadFixture(swapRouterFixture))

    getBalances = async (who: string) => {
      const balances = await Promise.all([
        wnative.balanceOf(who),
        tokens[0].balanceOf(who),
        tokens[1].balanceOf(who),
        tokens[2].balanceOf(who),
      ])
      return {
        wnative: balances[0],
        token0: balances[1],
        token1: balances[2],
        token2: balances[3],
      }
    }
  })

  // ensure the swap router never ends up with a balance
  afterEach('load fixture', async () => {
    const balances = await getBalances(router.address)
    expect(Object.values(balances).every((b) => b.eq(0))).to.be.eq(true)
    const balance = await ethers.provider.getBalance(router.address)
    expect(balance.eq(0)).to.be.eq(true)
  })

  it('bytecode size [ @skip-on-coverage ]', async () => {
    expect(((await router.provider.getCode(router.address)).length - 2) / 2).to.matchSnapshot()
  })

  describe('swaps', () => {
    const liquidity = 1000000
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
        recipient: wallet.address,
        amount0Desired: 1000000,
        amount1Desired: 1000000,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      }

      return nft.mint(liquidityParams)
    }

    async function createPoolWNativeToken(tokenAddress: string) {
      await wnative.deposit({ value: liquidity })
      await wnative.approve(nft.address, constants.MaxUint256)
      return createPool(wnative.address, tokenAddress)
    }

    beforeEach('create 0-1 and 1-2 pools', async () => {
      await createPool(tokens[0].address, tokens[1].address)
      await createPool(tokens[1].address, tokens[2].address)
    })

    describe('#exactInput', () => {
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
          amountIn,
          amountOutMinimum,
        }

        const data = [router.interface.encodeFunctionData('exactInput', [params])]
        if (outputIsWNativeToken)
          data.push(router.interface.encodeFunctionData('unwrapWNativeToken', [amountOutMinimum, trader.address]))

        // ensure that the swap fails if the limit is any tighter
        params.amountOutMinimum += 1
        await expect(router.connect(trader).exactInput(params, { value })).to.be.revertedWith('Too little received')
        params.amountOutMinimum -= 1

        // optimized for the gas test
        return data.length === 1
          ? router.connect(trader).exactInput(params, { value })
          : router.connect(trader).multicall(data, { value })
      }

      describe('single-pool', () => {
        it('0 -> 1', async () => {
          const pool = await factory.poolByPair(tokens[0].address, tokens[1].address)

          // get balances before
          const poolBefore = await getBalances(pool)
          const traderBefore = await getBalances(trader.address)

          await exactInput(tokens.slice(0, 2).map((token) => token.address))

          // get balances after
          const poolAfter = await getBalances(pool)
          const traderAfter = await getBalances(trader.address)

          expect(traderAfter.token0).to.be.eq(traderBefore.token0.sub(3))
          expect(traderAfter.token1).to.be.eq(traderBefore.token1.add(1))
          expect(poolAfter.token0).to.be.eq(poolBefore.token0.add(3))
          expect(poolAfter.token1).to.be.eq(poolBefore.token1.sub(1))
        })

        it('1 -> 0', async () => {
          const pool = await factory.poolByPair(tokens[1].address, tokens[0].address)

          // get balances before
          const poolBefore = await getBalances(pool)
          const traderBefore = await getBalances(trader.address)

          await exactInput(
            tokens
              .slice(0, 2)
              .reverse()
              .map((token) => token.address)
          )

          // get balances after
          const poolAfter = await getBalances(pool)
          const traderAfter = await getBalances(trader.address)

          expect(traderAfter.token0).to.be.eq(traderBefore.token0.add(1))
          expect(traderAfter.token1).to.be.eq(traderBefore.token1.sub(3))
          expect(poolAfter.token0).to.be.eq(poolBefore.token0.sub(1))
          expect(poolAfter.token1).to.be.eq(poolBefore.token1.add(3))
        })
      })

      describe('multi-pool', () => {
        it('0 -> 1 -> 2', async () => {
          const traderBefore = await getBalances(trader.address)

          await exactInput(
            tokens.map((token) => token.address),
            5,
            1
          )

          const traderAfter = await getBalances(trader.address)

          expect(traderAfter.token0).to.be.eq(traderBefore.token0.sub(5))
          expect(traderAfter.token2).to.be.eq(traderBefore.token2.add(1))
        })

        it('2 -> 1 -> 0', async () => {
          const traderBefore = await getBalances(trader.address)

          await exactInput(tokens.map((token) => token.address).reverse(), 5, 1)

          const traderAfter = await getBalances(trader.address)

          expect(traderAfter.token2).to.be.eq(traderBefore.token2.sub(5))
          expect(traderAfter.token0).to.be.eq(traderBefore.token0.add(1))
        })

        it('events', async () => {
          await expect(
            exactInput(
              tokens.map((token) => token.address),
              5,
              1
            )
          )
            .to.emit(tokens[0], 'Transfer')
            .withArgs(
              trader.address,
              computePoolAddress(await factory.poolDeployer(), [tokens[0].address, tokens[1].address]),
              5
            )
            .to.emit(tokens[1], 'Transfer')
            .withArgs(
              computePoolAddress(await factory.poolDeployer(), [tokens[0].address, tokens[1].address]),
              router.address,
              3
            )
            .to.emit(tokens[1], 'Transfer')
            .withArgs(
              router.address,
              computePoolAddress(await factory.poolDeployer(), [tokens[1].address, tokens[2].address]),
              3
            )
            .to.emit(tokens[2], 'Transfer')
            .withArgs(
              computePoolAddress(await factory.poolDeployer(), [tokens[1].address, tokens[2].address]),
              trader.address,
              1
            )
        })
      })

      describe('Native input', () => {
        describe('WNativeToken', () => {
          beforeEach(async () => {
            await createPoolWNativeToken(tokens[0].address)
          })

          it('WNativeToken -> 0', async () => {
            const pool = await factory.poolByPair(wnative.address, tokens[0].address)

            // get balances before
            const poolBefore = await getBalances(pool)
            const traderBefore = await getBalances(trader.address)

            await expect(exactInput([wnative.address, tokens[0].address]))
              .to.emit(wnative, 'Deposit')
              .withArgs(router.address, 3)

            // get balances after
            const poolAfter = await getBalances(pool)
            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token0).to.be.eq(traderBefore.token0.add(1))
            expect(poolAfter.wnative).to.be.eq(poolBefore.wnative.add(3))
            expect(poolAfter.token0).to.be.eq(poolBefore.token0.sub(1))
          })

          it('WNativeToken -> 0 -> 1', async () => {
            const traderBefore = await getBalances(trader.address)

            await expect(exactInput([wnative.address, tokens[0].address, tokens[1].address], 5))
              .to.emit(wnative, 'Deposit')
              .withArgs(router.address, 5)

            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token1).to.be.eq(traderBefore.token1.add(1))
          })
        })
      })

      describe('Native output', () => {
        describe('WNativeToken', () => {
          beforeEach(async () => {
            await createPoolWNativeToken(tokens[0].address)
            await createPoolWNativeToken(tokens[1].address)
          })

          it('0 -> WNativeToken', async () => {
            const pool = await factory.poolByPair(tokens[0].address, wnative.address)

            // get balances before
            const poolBefore = await getBalances(pool)
            const traderBefore = await getBalances(trader.address)

            await expect(exactInput([tokens[0].address, wnative.address]))
              .to.emit(wnative, 'Withdrawal')
              .withArgs(router.address, 1)

            // get balances after
            const poolAfter = await getBalances(pool)
            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token0).to.be.eq(traderBefore.token0.sub(3))
            expect(poolAfter.wnative).to.be.eq(poolBefore.wnative.sub(1))
            expect(poolAfter.token0).to.be.eq(poolBefore.token0.add(3))
          })

          it('0 -> 1 -> WNativeToken', async () => {
            // get balances before
            const traderBefore = await getBalances(trader.address)

            await expect(exactInput([tokens[0].address, tokens[1].address, wnative.address], 5))
              .to.emit(wnative, 'Withdrawal')
              .withArgs(router.address, 1)

            // get balances after
            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token0).to.be.eq(traderBefore.token0.sub(5))
          })
        })
      })
    })

    describe('#exactInputSingle', () => {
      async function exactInputSingle(
        tokenIn: string,
        tokenOut: string,
        amountIn: number = 3,
        amountOutMinimum: number = 1,
        limitSqrtPrice?: BigNumber
      ): Promise<ContractTransaction> {
        const inputIsWNativeToken = wnative.address === tokenIn
        const outputIsWNativeToken = tokenOut === wnative.address

        const value = inputIsWNativeToken ? amountIn : 0

        const params = {
          tokenIn,
          tokenOut,
          fee: FeeAmount.MEDIUM,
          limitSqrtPrice:
            limitSqrtPrice ?? tokenIn.toLowerCase() < tokenOut.toLowerCase()
              ? BigNumber.from('4295128740')
              : BigNumber.from('1461446703485210103287273052203988822378723970341'),
          recipient: outputIsWNativeToken ? constants.AddressZero : trader.address,
          deadline: 1,
          amountIn,
          amountOutMinimum,
        }

        const data = [router.interface.encodeFunctionData('exactInputSingle', [params])]
        if (outputIsWNativeToken)
          data.push(router.interface.encodeFunctionData('unwrapWNativeToken', [amountOutMinimum, trader.address]))

        // ensure that the swap fails if the limit is any tighter
        params.amountOutMinimum += 1
        await expect(router.connect(trader).exactInputSingle(params, { value })).to.be.revertedWith(
          'Too little received'
        )
        params.amountOutMinimum -= 1

        // optimized for the gas test
        return data.length === 1
          ? router.connect(trader).exactInputSingle(params, { value })
          : router.connect(trader).multicall(data, { value })
      }

      it('0 -> 1', async () => {
        const pool = await factory.poolByPair(tokens[0].address, tokens[1].address)

        // get balances before
        const poolBefore = await getBalances(pool)
        const traderBefore = await getBalances(trader.address)

        await exactInputSingle(tokens[0].address, tokens[1].address)

        // get balances after
        const poolAfter = await getBalances(pool)
        const traderAfter = await getBalances(trader.address)

        expect(traderAfter.token0).to.be.eq(traderBefore.token0.sub(3))
        expect(traderAfter.token1).to.be.eq(traderBefore.token1.add(1))
        expect(poolAfter.token0).to.be.eq(poolBefore.token0.add(3))
        expect(poolAfter.token1).to.be.eq(poolBefore.token1.sub(1))
      })

      it('1 -> 0', async () => {
        const pool = await factory.poolByPair(tokens[1].address, tokens[0].address)

        // get balances before
        const poolBefore = await getBalances(pool)
        const traderBefore = await getBalances(trader.address)

        await exactInputSingle(tokens[1].address, tokens[0].address)

        // get balances after
        const poolAfter = await getBalances(pool)
        const traderAfter = await getBalances(trader.address)

        expect(traderAfter.token0).to.be.eq(traderBefore.token0.add(1))
        expect(traderAfter.token1).to.be.eq(traderBefore.token1.sub(3))
        expect(poolAfter.token0).to.be.eq(poolBefore.token0.sub(1))
        expect(poolAfter.token1).to.be.eq(poolBefore.token1.add(3))
      })

      describe('Native input', () => {
        describe('WNativeToken', () => {
          beforeEach(async () => {
            await createPoolWNativeToken(tokens[0].address)
          })

          it('WNativeToken -> 0', async () => {
            const pool = await factory.poolByPair(wnative.address, tokens[0].address)

            // get balances before
            const poolBefore = await getBalances(pool)
            const traderBefore = await getBalances(trader.address)

            await expect(exactInputSingle(wnative.address, tokens[0].address))
              .to.emit(wnative, 'Deposit')
              .withArgs(router.address, 3)

            // get balances after
            const poolAfter = await getBalances(pool)
            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token0).to.be.eq(traderBefore.token0.add(1))
            expect(poolAfter.wnative).to.be.eq(poolBefore.wnative.add(3))
            expect(poolAfter.token0).to.be.eq(poolBefore.token0.sub(1))
          })
        })
      })

      describe('Native output', () => {
        describe('WNativeToken', () => {
          beforeEach(async () => {
            await createPoolWNativeToken(tokens[0].address)
            await createPoolWNativeToken(tokens[1].address)
          })

          it('0 -> WNativeToken', async () => {
            const pool = await factory.poolByPair(tokens[0].address, wnative.address)

            // get balances before
            const poolBefore = await getBalances(pool)
            const traderBefore = await getBalances(trader.address)

            await expect(exactInputSingle(tokens[0].address, wnative.address))
              .to.emit(wnative, 'Withdrawal')
              .withArgs(router.address, 1)

            // get balances after
            const poolAfter = await getBalances(pool)
            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token0).to.be.eq(traderBefore.token0.sub(3))
            expect(poolAfter.wnative).to.be.eq(poolBefore.wnative.sub(1))
            expect(poolAfter.token0).to.be.eq(poolBefore.token0.add(3))
          })
        })
      })
    })

    describe('#exactOutput', () => {
      async function exactOutput(
        tokens: string[],
        amountOut: number = 1,
        amountInMaximum: number = 3
      ): Promise<ContractTransaction> {
        const inputIsWNativeToken = tokens[0] === wnative.address
        const outputIsWNativeToken = tokens[tokens.length - 1] === wnative.address

        const value = inputIsWNativeToken ? amountInMaximum : 0

        const params = {
          path: encodePath(tokens.slice().reverse()),
          recipient: outputIsWNativeToken ? constants.AddressZero : trader.address,
          deadline: 1,
          amountOut,
          amountInMaximum,
        }

        const data = [router.interface.encodeFunctionData('exactOutput', [params])]
        if (inputIsWNativeToken) data.push(router.interface.encodeFunctionData('unwrapWNativeToken', [0, trader.address]))
        if (outputIsWNativeToken) data.push(router.interface.encodeFunctionData('unwrapWNativeToken', [amountOut, trader.address]))

        // ensure that the swap fails if the limit is any tighter
        params.amountInMaximum -= 1
        await expect(router.connect(trader).exactOutput(params, { value })).to.be.revertedWith('Too much requested')
        params.amountInMaximum += 1

        return router.connect(trader).multicall(data, { value })
      }

      describe('single-pool', () => {
        it('0 -> 1', async () => {
          const pool = await factory.poolByPair(tokens[0].address, tokens[1].address)

          // get balances before
          const poolBefore = await getBalances(pool)
          const traderBefore = await getBalances(trader.address)

          await exactOutput(tokens.slice(0, 2).map((token) => token.address))

          // get balances after
          const poolAfter = await getBalances(pool)
          const traderAfter = await getBalances(trader.address)

          expect(traderAfter.token0).to.be.eq(traderBefore.token0.sub(3))
          expect(traderAfter.token1).to.be.eq(traderBefore.token1.add(1))
          expect(poolAfter.token0).to.be.eq(poolBefore.token0.add(3))
          expect(poolAfter.token1).to.be.eq(poolBefore.token1.sub(1))
        })

        it('1 -> 0', async () => {
          const pool = await factory.poolByPair(tokens[1].address, tokens[0].address)

          // get balances before
          const poolBefore = await getBalances(pool)
          const traderBefore = await getBalances(trader.address)

          await exactOutput(
            tokens
              .slice(0, 2)
              .reverse()
              .map((token) => token.address)
          )

          // get balances after
          const poolAfter = await getBalances(pool)
          const traderAfter = await getBalances(trader.address)

          expect(traderAfter.token0).to.be.eq(traderBefore.token0.add(1))
          expect(traderAfter.token1).to.be.eq(traderBefore.token1.sub(3))
          expect(poolAfter.token0).to.be.eq(poolBefore.token0.sub(1))
          expect(poolAfter.token1).to.be.eq(poolBefore.token1.add(3))
        })
      })

      describe('multi-pool', () => {
        it('0 -> 1 -> 2', async () => {
          const traderBefore = await getBalances(trader.address)

          await exactOutput(
            tokens.map((token) => token.address),
            1,
            5
          )

          const traderAfter = await getBalances(trader.address)

          expect(traderAfter.token0).to.be.eq(traderBefore.token0.sub(5))
          expect(traderAfter.token2).to.be.eq(traderBefore.token2.add(1))
        })

        it('2 -> 1 -> 0', async () => {
          const traderBefore = await getBalances(trader.address)

          await exactOutput(tokens.map((token) => token.address).reverse(), 1, 5)

          const traderAfter = await getBalances(trader.address)

          expect(traderAfter.token2).to.be.eq(traderBefore.token2.sub(5))
          expect(traderAfter.token0).to.be.eq(traderBefore.token0.add(1))
        })

        it('events', async () => {
          await expect(
            exactOutput(
              tokens.map((token) => token.address),
              1,
              5
            )
          )
            .to.emit(tokens[2], 'Transfer')
            .withArgs(
              computePoolAddress(await factory.poolDeployer(), [tokens[2].address, tokens[1].address]),
              trader.address,
              1
            )
            .to.emit(tokens[1], 'Transfer')
            .withArgs(
              computePoolAddress(await factory.poolDeployer(), [tokens[1].address, tokens[0].address]),
              computePoolAddress(await factory.poolDeployer(), [tokens[2].address, tokens[1].address]),
              3
            )
            .to.emit(tokens[0], 'Transfer')
            .withArgs(
              trader.address,
              computePoolAddress(await factory.poolDeployer(), [tokens[1].address, tokens[0].address]),
              5
            )
        })
      })

      describe('Native input', () => {
        describe('WNativeToken', () => {
          beforeEach(async () => {
            await createPoolWNativeToken(tokens[0].address)
          })

          it('WNativeToken -> 0', async () => {
            const pool = await factory.poolByPair(wnative.address, tokens[0].address)

            // get balances before
            const poolBefore = await getBalances(pool)
            const traderBefore = await getBalances(trader.address)

            await expect(exactOutput([wnative.address, tokens[0].address]))
              .to.emit(wnative, 'Deposit')
              .withArgs(router.address, 3)

            // get balances after
            const poolAfter = await getBalances(pool)
            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token0).to.be.eq(traderBefore.token0.add(1))
            expect(poolAfter.wnative).to.be.eq(poolBefore.wnative.add(3))
            expect(poolAfter.token0).to.be.eq(poolBefore.token0.sub(1))
          })

          it('WNativeToken -> 0 -> 1', async () => {
            const traderBefore = await getBalances(trader.address)

            await expect(exactOutput([wnative.address, tokens[0].address, tokens[1].address], 1, 5))
              .to.emit(wnative, 'Deposit')
              .withArgs(router.address, 5)

            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token1).to.be.eq(traderBefore.token1.add(1))
          })
        })
      })

      describe('Native output', () => {
        describe('WNativeToken', () => {
          beforeEach(async () => {
            await createPoolWNativeToken(tokens[0].address)
            await createPoolWNativeToken(tokens[1].address)
          })

          it('0 -> WNativeToken', async () => {
            const pool = await factory.poolByPair(tokens[0].address, wnative.address)

            // get balances before
            const poolBefore = await getBalances(pool)
            const traderBefore = await getBalances(trader.address)

            await expect(exactOutput([tokens[0].address, wnative.address]))
              .to.emit(wnative, 'Withdrawal')
              .withArgs(router.address, 1)

            // get balances after
            const poolAfter = await getBalances(pool)
            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token0).to.be.eq(traderBefore.token0.sub(3))
            expect(poolAfter.wnative).to.be.eq(poolBefore.wnative.sub(1))
            expect(poolAfter.token0).to.be.eq(poolBefore.token0.add(3))
          })

          it('0 -> 1 -> WNativeToken', async () => {
            // get balances before
            const traderBefore = await getBalances(trader.address)

            await expect(exactOutput([tokens[0].address, tokens[1].address, wnative.address], 1, 5))
              .to.emit(wnative, 'Withdrawal')
              .withArgs(router.address, 1)

            // get balances after
            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token0).to.be.eq(traderBefore.token0.sub(5))
          })
        })
      })
    })

    describe('#exactOutputSingle', () => {
      async function exactOutputSingle(
        tokenIn: string,
        tokenOut: string,
        amountOut: number = 1,
        amountInMaximum: number = 3,
        limitSqrtPrice?: BigNumber
      ): Promise<ContractTransaction> {
        const inputIsWNativeToken = tokenIn === wnative.address
        const outputIsWNativeToken = tokenOut === wnative.address

        const value = inputIsWNativeToken ? amountInMaximum : 0

        const params = {
          tokenIn,
          tokenOut,
          fee: FeeAmount.MEDIUM,
          recipient: outputIsWNativeToken ? constants.AddressZero : trader.address,
          deadline: 1,
          amountOut,
          amountInMaximum,
          limitSqrtPrice:
            limitSqrtPrice ?? tokenIn.toLowerCase() < tokenOut.toLowerCase()
              ? BigNumber.from('4295128740')
              : BigNumber.from('1461446703485210103287273052203988822378723970341'),
        }

        const data = [router.interface.encodeFunctionData('exactOutputSingle', [params])]
        if (inputIsWNativeToken) data.push(router.interface.encodeFunctionData('refundNativeToken'))
        if (outputIsWNativeToken) data.push(router.interface.encodeFunctionData('unwrapWNativeToken', [amountOut, trader.address]))

        // ensure that the swap fails if the limit is any tighter
        params.amountInMaximum -= 1
        await expect(router.connect(trader).exactOutputSingle(params, { value })).to.be.revertedWith(
          'Too much requested'
        )
        params.amountInMaximum += 1

        return router.connect(trader).multicall(data, { value })
      }

      it('0 -> 1', async () => {
        const pool = await factory.poolByPair(tokens[0].address, tokens[1].address)

        // get balances before
        const poolBefore = await getBalances(pool)
        const traderBefore = await getBalances(trader.address)

        await exactOutputSingle(tokens[0].address, tokens[1].address)

        // get balances after
        const poolAfter = await getBalances(pool)
        const traderAfter = await getBalances(trader.address)

        expect(traderAfter.token0).to.be.eq(traderBefore.token0.sub(3))
        expect(traderAfter.token1).to.be.eq(traderBefore.token1.add(1))
        expect(poolAfter.token0).to.be.eq(poolBefore.token0.add(3))
        expect(poolAfter.token1).to.be.eq(poolBefore.token1.sub(1))
      })

      it('1 -> 0', async () => {
        const pool = await factory.poolByPair(tokens[1].address, tokens[0].address)

        // get balances before
        const poolBefore = await getBalances(pool)
        const traderBefore = await getBalances(trader.address)

        await exactOutputSingle(tokens[1].address, tokens[0].address)

        // get balances after
        const poolAfter = await getBalances(pool)
        const traderAfter = await getBalances(trader.address)

        expect(traderAfter.token0).to.be.eq(traderBefore.token0.add(1))
        expect(traderAfter.token1).to.be.eq(traderBefore.token1.sub(3))
        expect(poolAfter.token0).to.be.eq(poolBefore.token0.sub(1))
        expect(poolAfter.token1).to.be.eq(poolBefore.token1.add(3))
      })

      describe('Native input', () => {
        describe('WNativeToken', () => {
          beforeEach(async () => {
            await createPoolWNativeToken(tokens[0].address)
          })

          it('WNativeToken -> 0', async () => {
            const pool = await factory.poolByPair(wnative.address, tokens[0].address)

            // get balances before
            const poolBefore = await getBalances(pool)
            const traderBefore = await getBalances(trader.address)

            await expect(exactOutputSingle(wnative.address, tokens[0].address))
              .to.emit(wnative, 'Deposit')
              .withArgs(router.address, 3)

            // get balances after
            const poolAfter = await getBalances(pool)
            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token0).to.be.eq(traderBefore.token0.add(1))
            expect(poolAfter.wnative).to.be.eq(poolBefore.wnative.add(3))
            expect(poolAfter.token0).to.be.eq(poolBefore.token0.sub(1))
          })
        })
      })

      describe('Native output', () => {
        describe('WNativeToken', () => {
          beforeEach(async () => {
            await createPoolWNativeToken(tokens[0].address)
            await createPoolWNativeToken(tokens[1].address)
          })

          it('0 -> WNativeToken', async () => {
            const pool = await factory.poolByPair(tokens[0].address, wnative.address)

            // get balances before
            const poolBefore = await getBalances(pool)
            const traderBefore = await getBalances(trader.address)

            await expect(exactOutputSingle(tokens[0].address, wnative.address))
              .to.emit(wnative, 'Withdrawal')
              .withArgs(router.address, 1)

            // get balances after
            const poolAfter = await getBalances(pool)
            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token0).to.be.eq(traderBefore.token0.sub(3))
            expect(poolAfter.wnative).to.be.eq(poolBefore.wnative.sub(1))
            expect(poolAfter.token0).to.be.eq(poolBefore.token0.add(3))
          })
        })
      })
    })

    describe('*WithFee', () => {
      const feeRecipient = '0xfEE0000000000000000000000000000000000000'

      it('#sweepTokenWithFee', async () => {
        const amountOutMinimum = 100
        const params = {
          path: encodePath([tokens[0].address, tokens[1].address]),
          recipient: router.address,
          deadline: 1,
          amountIn: 102,
          amountOutMinimum,
        }

        const data = [
          router.interface.encodeFunctionData('exactInput', [params]),
          router.interface.encodeFunctionData('sweepTokenWithFee', [
            tokens[1].address,
            amountOutMinimum,
            trader.address,
            100,
            feeRecipient,
          ]),
        ]

        await router.connect(trader).multicall(data)

        const balance = await tokens[1].balanceOf(feeRecipient)
        expect(balance.eq(1)).to.be.eq(true)
      })

      it('#unwrapWNativeTokenWithFee', async () => {
        const startBalance = await ethers.provider.getBalance(feeRecipient)
        await createPoolWNativeToken(tokens[0].address)

        const amountOutMinimum = 100
        const params = {
          path: encodePath([tokens[0].address, wnative.address]),
          recipient: router.address,
          deadline: 1,
          amountIn: 102,
          amountOutMinimum,
        }

        const data = [
          router.interface.encodeFunctionData('exactInput', [params]),
          router.interface.encodeFunctionData('unwrapWNativeTokenWithFee', [
            amountOutMinimum,
            trader.address,
            100,
            feeRecipient,
          ]),
        ]

        await router.connect(trader).multicall(data)
        const endBalance = await ethers.provider.getBalance(feeRecipient)
        expect(endBalance.sub(startBalance).eq(1)).to.be.eq(true)
      })
    })
  })
})
