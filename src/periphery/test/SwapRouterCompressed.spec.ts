import { BigNumber, constants, Contract, Wallet } from 'ethers'
import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { IWNativeToken, MockTimeNonfungiblePositionManager, SwapRouterCompressed, TestERC20 } from '../typechain'
import completeFixtureCompressed from './shared/completeFixtureCompressed'
import { FeeAmount, TICK_SPACINGS } from './shared/constants'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { expandTo18Decimals } from './shared/expandTo18Decimals'
import { expect } from './shared/expect'
import { encodePath } from './shared/path'
import { getMaxTick, getMinTick } from './shared/ticks'
import { computePoolAddress } from './shared/computePoolAddress'
import { encodeRouterCalldata, EncodeRouterCalldataParams } from './shared/encodeRouterCalldata'

describe.only('SwapRouterCompressed', function () {
  this.timeout(40000)
  let wallet: Wallet
  let trader: Wallet

  const swapRouterFixture: () => Promise<{
    wnative: IWNativeToken
    factory: Contract
    router: SwapRouterCompressed
    nft: MockTimeNonfungiblePositionManager
    tokens: [TestERC20, TestERC20, TestERC20]
  }> = async () => {
    const { wnative, factory, router, tokens, nft } = await completeFixtureCompressed()

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
  let router: SwapRouterCompressed
  let nft: MockTimeNonfungiblePositionManager
  let tokens: [TestERC20, TestERC20, TestERC20]
  let tokensMap: Record<string, number> = {};
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
    tokensMap[wnative.address] = 0;
    let nextTokenIndex = 1;
    for (let token of tokens) {
      tokensMap[token.address] = nextTokenIndex;
      await router.addTokenAddress(token.address);
      nextTokenIndex++;
    }

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

    async function sendPayload(from: Wallet, value: number, params: EncodeRouterCalldataParams): Promise<boolean> {
      let calldata = encodeRouterCalldata(params);
      let tx = await router.populateTransaction.addTokenAddress(ethers.constants.AddressZero, {value: value});
      tx.data = '0x' + calldata;
      tx.from = from.address;
      let txResponse = await from.sendTransaction(tx);

      await txResponse.wait();
      return true;
    }

    describe('#exactInput', () => {
      async function exactInput(
        tokens: string[],
        amountIn: number = 3,
        amountOutMinimum: number = 1,
        wrappedNative: boolean = false
      ): Promise<boolean> {
        const inputIsWNativeToken = wnative.address === tokens[0]
        const outputIsWNativeToken = tokens[tokens.length - 1] === wnative.address
        const value = inputIsWNativeToken ? (wrappedNative ? 0 : amountIn) : 0
        let tokensIndexes: number[] = tokens.map((token: string) => tokensMap[token]);

        const params: EncodeRouterCalldataParams = {
          exactIn: true,
          hasRecipient: true,
          hasDeadline: true,
          tokens: tokensIndexes,
          recipient: outputIsWNativeToken ? constants.AddressZero : trader.address,
          deadline: BigInt(1),
          amountIn: BigInt(amountIn),
          amountOut: BigInt(amountOutMinimum),
          wrappedNative
        };

        await sendPayload(trader, value, params)

        // ensure that the swap fails if the limit is any tighter
        params.amountOut += 1n;
        await expect(
          sendPayload(trader, value, params)
          ).to.be.revertedWith('Too little received')
       return true;
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

            await exactInput([wnative.address, tokens[0].address])

            // get balances after
            const poolAfter = await getBalances(pool)
            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token0).to.be.eq(traderBefore.token0.add(1))
            expect(poolAfter.wnative).to.be.eq(poolBefore.wnative.add(3))
            expect(poolAfter.token0).to.be.eq(poolBefore.token0.sub(1))
          })

          it('WNativeToken -> 0 -> 1', async () => {
            const traderBefore = await getBalances(trader.address)

            await exactInput([wnative.address, tokens[0].address, tokens[1].address], 5)

            const traderAfter = await getBalances(trader.address)
            expect(traderAfter.token1).to.be.eq(traderBefore.token1.add(1))
          })
        })
      })
    })

    describe('#exactOutput', () => {
      async function exactOutput(
        tokens: string[],
        amountOut: number = 1,
        amountInMaximum: number = 3,
        wrappedNative: boolean = false
      ): Promise<boolean> {
        const inputIsWNativeToken = tokens[0] === wnative.address
        const outputIsWNativeToken = tokens[tokens.length - 1] === wnative.address

        const value = inputIsWNativeToken ? (wrappedNative ? 0 : amountInMaximum) : 0

        let tokensIndexes: number[] = tokens.slice().reverse().map((token: string) => tokensMap[token]);
        const params: EncodeRouterCalldataParams = {
          exactIn: false,
          hasRecipient: true,
          hasDeadline: true,
          tokens: tokensIndexes,
          recipient: outputIsWNativeToken ? constants.AddressZero : trader.address,
          deadline: BigInt(1),
          amountIn: BigInt(amountOut),
          amountOut: BigInt(amountInMaximum),
          wrappedNative
        };
        await sendPayload(trader, value, params);

        // ensure that the swap fails if the limit is any tighter
        params.amountOut -= 1n;
        await expect(
          sendPayload(trader, value > 0 ? value - 1 : 0, params)
          ).to.be.revertedWith('Too much requested')
       return true;
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

      })

      describe('Native input', () => {
        describe('WNativeToken', () => {
          beforeEach(async () => {
            await createPoolWNativeToken(tokens[0].address)
            await wnative.deposit({ value: 1000 });
            await wnative.transfer(trader.address, 1000);
            await wnative.connect(trader).approve(router.address, 1000);
          })

          it('WNativeToken -> 0', async () => {
            const pool = await factory.poolByPair(wnative.address, tokens[0].address)

            // get balances before
            const poolBefore = await getBalances(pool)
            const traderBefore = await getBalances(trader.address)

            await exactOutput([wnative.address, tokens[0].address])

            // get balances after
            const poolAfter = await getBalances(pool)
            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token0).to.be.eq(traderBefore.token0.add(1))
            expect(poolAfter.wnative).to.be.eq(poolBefore.wnative.add(3))
            expect(poolAfter.token0).to.be.eq(poolBefore.token0.sub(1))
          })

          it('WNativeToken -> 0 -> 1', async () => {
            const traderBefore = await getBalances(trader.address)

            await exactOutput([wnative.address, tokens[0].address, tokens[1].address], 1, 5)

            const traderAfter = await getBalances(trader.address)

            expect(traderAfter.token1).to.be.eq(traderBefore.token1.add(1))
          })
        })
      })

    })
  })
})
