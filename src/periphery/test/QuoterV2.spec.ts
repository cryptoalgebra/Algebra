import { constants, Wallet } from 'ethers'
import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { MockTimeNonfungiblePositionManager, QuoterV2, TestERC20 } from '../typechain'
import completeFixture from './shared/completeFixture'
import { FeeAmount, MaxUint128 } from './shared/constants'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { expandTo18Decimals } from './shared/expandTo18Decimals'
import { expect } from './shared/expect'
import { encodePath } from './shared/path'
import { createPool, createPoolWithMultiplePositions, createPoolWithZeroTickInitialized } from './shared/quoter'
import snapshotGasCost from './shared/snapshotGasCost'

describe('QuoterV2', function () {
  this.timeout(40000)
  let wallet: Wallet
  let trader: Wallet

  const swapRouterFixture: () => Promise<{
    nft: MockTimeNonfungiblePositionManager
    tokens: [TestERC20, TestERC20, TestERC20]
    quoter: QuoterV2
  }> = async () => {
    const { wnative, factory, router, tokens, nft } = await completeFixture()

    // approve & fund wallets
    for (const token of tokens) {
      await token.approve(router.address, constants.MaxUint256)
      await token.approve(nft.address, constants.MaxUint256)
      await token.connect(trader).approve(router.address, constants.MaxUint256)
      await token.transfer(trader.address, expandTo18Decimals(1_000_000))
    }

    const quoterFactory = await ethers.getContractFactory('QuoterV2')
    quoter = (await quoterFactory.deploy(factory.address, wnative.address, await factory.poolDeployer())) as QuoterV2

    return {
      tokens,
      nft,
      quoter,
    }
  }

  let nft: MockTimeNonfungiblePositionManager
  let tokens: [TestERC20, TestERC20, TestERC20]
  let quoter: QuoterV2

  before('create fixture loader', async () => {
    const wallets = await (ethers as any).getSigners()
    ;[wallet, trader] = wallets
  })

  // helper for getting wnative and token balances
  beforeEach('load fixture', async () => {
    ;({ tokens, nft, quoter } = await loadFixture(swapRouterFixture))
  })

  describe('quotes', () => {
    beforeEach(async () => {
      await createPool(nft, wallet, tokens[0].address, tokens[1].address)
      await createPool(nft, wallet, tokens[1].address, tokens[2].address)
      await createPoolWithMultiplePositions(nft, wallet, tokens[0].address, tokens[2].address)
    })

    describe('#quoteExactInput', () => {
      it('0 -> 2 cross 2 tick', async () => {
        const {
          amountOut,
          sqrtPriceX96AfterList,
          initializedTicksCrossedList,
          gasEstimate,
        } = await quoter.callStatic.quoteExactInput(
          encodePath([tokens[0].address, tokens[2].address]),
          10000
        )

        ////await snapshotGasCost(gasEstimate)
        expect(sqrtPriceX96AfterList.length).to.eq(1)
        expect(sqrtPriceX96AfterList[0]).to.eq('78459593188549728720178728761')
        expect(initializedTicksCrossedList[0]).to.eq(2)
        expect(amountOut).to.eq(9899)
      })

      it('0 -> 2 cross 2 tick where after is initialized', async () => {
        // The swap amount is set such that the active tick after the swap is -120.
        // -120 is an initialized tick for this pool. We check that we don't count it.
        const {
          amountOut,
          sqrtPriceX96AfterList,
          initializedTicksCrossedList,
          gasEstimate,
        } = await quoter.callStatic.quoteExactInput(
          encodePath([tokens[0].address, tokens[2].address]),
          6198
        )

        ////await snapshotGasCost(gasEstimate)
        expect(sqrtPriceX96AfterList.length).to.eq(1)
        expect(sqrtPriceX96AfterList[0]).to.eq('78755992497053066283316544500')
        expect(initializedTicksCrossedList.length).to.eq(1)
        expect(initializedTicksCrossedList[0]).to.eq(1)
        expect(amountOut).to.eq(6158)
      })

      it('0 -> 2 cross 1 tick', async () => {
        const {
          amountOut,
          sqrtPriceX96AfterList,
          initializedTicksCrossedList,
          gasEstimate,
        } = await quoter.callStatic.quoteExactInput(
          encodePath([tokens[0].address, tokens[2].address]),
          4000
        )

        ////await snapshotGasCost(gasEstimate)
        expect(initializedTicksCrossedList[0]).to.eq(1)
        expect(sqrtPriceX96AfterList.length).to.eq(1)
        expect(sqrtPriceX96AfterList[0]).to.eq('78925601745505355567663242450')
        expect(amountOut).to.eq(3982)
      })

      it('0 -> 2 cross 0 tick, starting tick not initialized', async () => {
        // Tick before 0, tick after -1.
        const {
          amountOut,
          sqrtPriceX96AfterList,
          initializedTicksCrossedList,
          gasEstimate,
        } = await quoter.callStatic.quoteExactInput(
          encodePath([tokens[0].address, tokens[2].address]),
          10
        )

        ////await snapshotGasCost(gasEstimate)
        expect(initializedTicksCrossedList[0]).to.eq(0)
        expect(sqrtPriceX96AfterList.length).to.eq(1)
        expect(sqrtPriceX96AfterList[0]).to.eq('79227483487511329217250071027')
        expect(amountOut).to.eq(8)
      })

      it('0 -> 2 cross 0 tick, starting tick initialized', async () => {
        // Tick before 0, tick after -1. Tick 0 initialized.
        await createPoolWithZeroTickInitialized(nft, wallet, tokens[0].address, tokens[2].address)

        const {
          amountOut,
          sqrtPriceX96AfterList,
          initializedTicksCrossedList,
          gasEstimate,
        } = await quoter.callStatic.quoteExactInput(
          encodePath([tokens[0].address, tokens[2].address]),
          10
        )

        ////await snapshotGasCost(gasEstimate)
        expect(initializedTicksCrossedList[0]).to.eq(1)
        expect(sqrtPriceX96AfterList.length).to.eq(1)
        expect(sqrtPriceX96AfterList[0]).to.eq('79227817515327498931091950511')
        expect(amountOut).to.eq(8)
      })

      it('2 -> 0 cross 2', async () => {
        const {
          amountOut,
          sqrtPriceX96AfterList,
          initializedTicksCrossedList,
          gasEstimate,
        } = await quoter.callStatic.quoteExactInput(
          encodePath([tokens[2].address, tokens[0].address]),
          10000
        )

        ////await snapshotGasCost(gasEstimate)
        expect(initializedTicksCrossedList[0]).to.eq(2)
        expect(sqrtPriceX96AfterList.length).to.eq(1)
        expect(sqrtPriceX96AfterList[0]).to.eq('80004260540860811531331597290')
        expect(initializedTicksCrossedList.length).to.eq(1)
        expect(amountOut).to.eq(9899)
      })

      it('2 -> 0 cross 2 where tick after is initialized', async () => {
        // The swap amount is set such that the active tick after the swap is 120.
        // 120 is an initialized tick for this pool. We check we don't count it.

        const {
          amountOut,
          sqrtPriceX96AfterList,
          initializedTicksCrossedList,
          gasEstimate,
        } = await quoter.callStatic.quoteExactInput(
          encodePath([tokens[2].address, tokens[0].address]),
          6250
        )

        ////await snapshotGasCost(gasEstimate)
        console.log(sqrtPriceX96AfterList[0].toString())
        expect(initializedTicksCrossedList[0]).to.eq(2)
        expect(sqrtPriceX96AfterList.length).to.eq(1)
        expect(sqrtPriceX96AfterList[0]).to.eq('79707154931432320265355807476')
        expect(initializedTicksCrossedList.length).to.eq(1)
        expect(amountOut).to.eq(6208)
      })

      it('2 -> 0 cross 0 tick, starting tick initialized', async () => {
        // Tick 0 initialized. Tick after = 1
        await createPoolWithZeroTickInitialized(nft, wallet, tokens[0].address, tokens[2].address)

        const {
          amountOut,
          sqrtPriceX96AfterList,
          initializedTicksCrossedList,
          gasEstimate,
        } = await quoter.callStatic.quoteExactInput(
          encodePath([tokens[2].address, tokens[0].address]),
          200
        )

        ////await snapshotGasCost(gasEstimate)
        expect(initializedTicksCrossedList[0]).to.eq(0)
        expect(sqrtPriceX96AfterList.length).to.eq(1)
        expect(sqrtPriceX96AfterList[0]).to.eq('79235729830182478001034429156')
        expect(initializedTicksCrossedList.length).to.eq(1)
        expect(amountOut).to.eq(198)
      })

      it('2 -> 0 cross 0 tick, starting tick not initialized', async () => {
        // Tick 0 initialized. Tick after = 1
        const {
          amountOut,
          sqrtPriceX96AfterList,
          initializedTicksCrossedList,
          gasEstimate,
        } = await quoter.callStatic.quoteExactInput(
          encodePath([tokens[2].address, tokens[0].address]),
          103
        )

        ////await snapshotGasCost(gasEstimate)
        expect(initializedTicksCrossedList[0]).to.eq(0)
        expect(sqrtPriceX96AfterList.length).to.eq(1)
        expect(sqrtPriceX96AfterList[0]).to.eq('79235858216754624215638319723')
        expect(initializedTicksCrossedList.length).to.eq(1)
        expect(amountOut).to.eq(101)
      })

      it('2 -> 1', async () => {
        const {
          amountOut,
          sqrtPriceX96AfterList,
          initializedTicksCrossedList,
          gasEstimate,
        } = await quoter.callStatic.quoteExactInput(
          encodePath([tokens[2].address, tokens[1].address]),
          10000
        )

        ////await snapshotGasCost(gasEstimate)
        expect(sqrtPriceX96AfterList.length).to.eq(1)
        expect(sqrtPriceX96AfterList[0]).to.eq('80020364911244466705141796295')
        expect(initializedTicksCrossedList[0]).to.eq(0)
        expect(amountOut).to.eq(9900)
      })

      it('0 -> 2 -> 1', async () => {
        const {
          amountOut,
          sqrtPriceX96AfterList,
          initializedTicksCrossedList,
          gasEstimate,
        } = await quoter.callStatic.quoteExactInput(
          encodePath([tokens[0].address, tokens[2].address, tokens[1].address]),
          10000
        )

        ////await snapshotGasCost(gasEstimate)
        expect(sqrtPriceX96AfterList.length).to.eq(2)
        expect(sqrtPriceX96AfterList[0]).to.eq('78459593188549728720178728761')
        expect(sqrtPriceX96AfterList[1]).to.eq('80012362866830526007044848356')
        expect(initializedTicksCrossedList[0]).to.eq(2)
        expect(initializedTicksCrossedList[1]).to.eq(0)
        expect(amountOut).to.eq(9800)
      })
    })

    describe('#quoteExactInputSingle', () => {
      it('0 -> 2', async () => {
        const {
          amountOut: quote,
          sqrtPriceX96After,
          initializedTicksCrossed,
          gasEstimate,
        } = await quoter.callStatic.quoteExactInputSingle({
          tokenIn: tokens[0].address,
          tokenOut: tokens[2].address,
          amountIn: 10000,
          // -2%
          limitSqrtPrice: encodePriceSqrt(100, 102),
        })

        expect(initializedTicksCrossed).to.eq(2)
        expect(quote).to.eq(9899)
        expect(sqrtPriceX96After).to.eq('78459593188549728720178728761')
      })

      it('2 -> 0', async () => {
        const {
          amountOut: quote,
          sqrtPriceX96After,
          initializedTicksCrossed,
          gasEstimate,
        } = await quoter.callStatic.quoteExactInputSingle({
          tokenIn: tokens[2].address,
          tokenOut: tokens[0].address,
          amountIn: 10000,
          // +2%
          limitSqrtPrice: encodePriceSqrt(102, 100),
        })

        expect(initializedTicksCrossed).to.eq(2)
        expect(quote).to.eq(9899)
        expect(sqrtPriceX96After).to.eq('80004260540860811531331597290')
      })

      describe('gas [ @skip-on-coverage ]', () => {
        it('0 -> 2', async () => {
          const {
            amountOut: quote,
            sqrtPriceX96After,
            initializedTicksCrossed,
            gasEstimate,
          } = await quoter.callStatic.quoteExactInputSingle({
            tokenIn: tokens[0].address,
            tokenOut: tokens[2].address,
            amountIn: 10000,
            // -2%
            limitSqrtPrice: encodePriceSqrt(100, 102),
          })
  
          await snapshotGasCost(gasEstimate)
        })
  
        it('2 -> 0', async () => {
          const {
            amountOut: quote,
            sqrtPriceX96After,
            initializedTicksCrossed,
            gasEstimate,
          } = await quoter.callStatic.quoteExactInputSingle({
            tokenIn: tokens[2].address,
            tokenOut: tokens[0].address,
            amountIn: 10000,
            // +2%
            limitSqrtPrice: encodePriceSqrt(102, 100),
          })
  
          await snapshotGasCost(gasEstimate)
        })        
      })
    })

    describe('#quoteExactOutput', () => {
      it('0 -> 2 cross 2 tick', async () => {
        const {
          amountIn,
          sqrtPriceX96AfterList,
          initializedTicksCrossedList,
          gasEstimate,
        } = await quoter.callStatic.quoteExactOutput(
          encodePath([tokens[2].address, tokens[0].address]),
          15000
        )

        expect(initializedTicksCrossedList.length).to.eq(1)
        expect(initializedTicksCrossedList[0]).to.eq(2)
        expect(amountIn).to.eq(15228)

        expect(sqrtPriceX96AfterList.length).to.eq(1)
        expect(sqrtPriceX96AfterList[0]).to.eq('78055527257643669242286029831')
      })

      it('0 -> 2 cross 2 where tick after is initialized', async () => {
        // The swap amount is set such that the active tick after the swap is -120.
        // -120 is an initialized tick for this pool. We check that we count it.
        const {
          amountIn,
          sqrtPriceX96AfterList,
          initializedTicksCrossedList,
          gasEstimate,
        } = await quoter.callStatic.quoteExactOutput(
          encodePath([tokens[2].address, tokens[0].address]),
          6158
        )

        expect(sqrtPriceX96AfterList.length).to.eq(1)
        expect(sqrtPriceX96AfterList[0]).to.eq('78756056567076985409608047254')
        expect(initializedTicksCrossedList.length).to.eq(1)
        expect(initializedTicksCrossedList[0]).to.eq(1)
        expect(amountIn).to.eq(6198)
      })

      it('0 -> 2 cross 1 tick', async () => {
        const {
          amountIn,
          sqrtPriceX96AfterList,
          initializedTicksCrossedList,
          gasEstimate,
        } = await quoter.callStatic.quoteExactOutput(
          encodePath([tokens[2].address, tokens[0].address]),
          4000
        )

        expect(initializedTicksCrossedList.length).to.eq(1)
        expect(initializedTicksCrossedList[0]).to.eq(1)
        expect(amountIn).to.eq(4018)

        expect(sqrtPriceX96AfterList.length).to.eq(1)
        expect(sqrtPriceX96AfterList[0]).to.eq('78924219757724709840818372098')
      })

      it('0 -> 2 cross 0 tick starting tick initialized', async () => {
        // Tick before 0, tick after 1. Tick 0 initialized.
        await createPoolWithZeroTickInitialized(nft, wallet, tokens[0].address, tokens[2].address)
        const {
          amountIn,
          sqrtPriceX96AfterList,
          initializedTicksCrossedList,
          gasEstimate,
        } = await quoter.callStatic.quoteExactOutput(
          encodePath([tokens[2].address, tokens[0].address]),
          100
        )

        expect(initializedTicksCrossedList.length).to.eq(1)
        expect(initializedTicksCrossedList[0]).to.eq(1)
        expect(amountIn).to.eq(102)

        expect(sqrtPriceX96AfterList.length).to.eq(1)
        expect(sqrtPriceX96AfterList[0]).to.eq('79224329176051641448521403903')
      })

      it('0 -> 2 cross 0 tick starting tick not initialized', async () => {
        const {
          amountIn,
          sqrtPriceX96AfterList,
          initializedTicksCrossedList,
          gasEstimate,
        } = await quoter.callStatic.quoteExactOutput(
          encodePath([tokens[2].address, tokens[0].address]),
          10
        )

        expect(initializedTicksCrossedList.length).to.eq(1)
        expect(initializedTicksCrossedList[0]).to.eq(0)
        expect(amountIn).to.eq(12)

        expect(sqrtPriceX96AfterList.length).to.eq(1)
        expect(sqrtPriceX96AfterList[0]).to.eq('79227408033628034983534698435')
      })

      it('2 -> 0 cross 2 ticks', async () => {
        const {
          amountIn,
          sqrtPriceX96AfterList,
          initializedTicksCrossedList,
          gasEstimate,
        } = await quoter.callStatic.quoteExactOutput(
          encodePath([tokens[0].address, tokens[2].address]),
          15000
        )

        expect(initializedTicksCrossedList.length).to.eq(1)
        expect(initializedTicksCrossedList[0]).to.eq(2)
        expect(amountIn).to.eq(15228)
        expect(sqrtPriceX96AfterList.length).to.eq(1)
        expect(sqrtPriceX96AfterList[0]).to.eq('80418414376567919517220409857')
      })

      it('2 -> 0 cross 2 where tick after is initialized', async () => {
        // The swap amount is set such that the active tick after the swap is 120.
        // 120 is an initialized tick for this pool. We check that we don't count it.
        const {
          amountIn,
          sqrtPriceX96AfterList,
          initializedTicksCrossedList,
          gasEstimate,
        } = await quoter.callStatic.quoteExactOutput(
          encodePath([tokens[0].address, tokens[2].address]),
          6223
        )

        expect(initializedTicksCrossedList[0]).to.eq(2)
        expect(sqrtPriceX96AfterList.length).to.eq(1)
        expect(sqrtPriceX96AfterList[0]).to.eq('79708304437530892332449657932')
        expect(initializedTicksCrossedList.length).to.eq(1)
        expect(amountIn).to.eq(6265)
      })

      it('2 -> 0 cross 1 tick', async () => {
        const {
          amountIn,
          sqrtPriceX96AfterList,
          initializedTicksCrossedList,
          gasEstimate,
        } = await quoter.callStatic.quoteExactOutput(
          encodePath([tokens[0].address, tokens[2].address]),
          6000
        )

        expect(initializedTicksCrossedList[0]).to.eq(1)
        expect(sqrtPriceX96AfterList.length).to.eq(1)
        expect(sqrtPriceX96AfterList[0]).to.eq('79690640184021170956740081887')
        expect(initializedTicksCrossedList.length).to.eq(1)
        expect(amountIn).to.eq(6038)
      })

      it('2 -> 1', async () => {
        const {
          amountIn,
          sqrtPriceX96AfterList,
          initializedTicksCrossedList,
          gasEstimate,
        } = await quoter.callStatic.quoteExactOutput(
          encodePath([tokens[1].address, tokens[2].address]),
          9899
        )

        expect(sqrtPriceX96AfterList.length).to.eq(1)
        expect(sqrtPriceX96AfterList[0]).to.eq('80020283298637550708002466755')
        expect(initializedTicksCrossedList[0]).to.eq(0)
        expect(amountIn).to.eq(9999)
      })

      it('0 -> 2 -> 1', async () => {
        const {
          amountIn,
          sqrtPriceX96AfterList,
          initializedTicksCrossedList,
          gasEstimate,
        } = await quoter.callStatic.quoteExactOutput(
          encodePath([tokens[0].address, tokens[2].address, tokens[1].address].reverse()),
          9795
        )

        expect(sqrtPriceX96AfterList.length).to.eq(2)
        expect(sqrtPriceX96AfterList[0]).to.eq('80011878867774185742895612865')
        expect(sqrtPriceX96AfterList[1]).to.eq('78460145483604017214376258786')
        expect(initializedTicksCrossedList[0]).to.eq(0)
        expect(initializedTicksCrossedList[1]).to.eq(2)
        expect(amountIn).to.eq(9993)
      })

      describe('gas [ @skip-on-coverage ]', () => {
        it('0 -> 2 cross 2 tick', async () => {
          const {
            amountIn,
            sqrtPriceX96AfterList,
            initializedTicksCrossedList,
            gasEstimate,
          } = await quoter.callStatic.quoteExactOutput(
            encodePath([tokens[2].address, tokens[0].address]),
            15000
          )
  
          await snapshotGasCost(gasEstimate)
        })
  
        it('0 -> 2 cross 2 where tick after is initialized', async () => {
          // The swap amount is set such that the active tick after the swap is -120.
          // -120 is an initialized tick for this pool. We check that we count it.
          const {
            amountIn,
            sqrtPriceX96AfterList,
            initializedTicksCrossedList,
            gasEstimate,
          } = await quoter.callStatic.quoteExactOutput(
            encodePath([tokens[2].address, tokens[0].address]),
            6158
          )
  
          await snapshotGasCost(gasEstimate)
        })
  
        it('0 -> 2 cross 1 tick', async () => {
          const {
            amountIn,
            sqrtPriceX96AfterList,
            initializedTicksCrossedList,
            gasEstimate,
          } = await quoter.callStatic.quoteExactOutput(
            encodePath([tokens[2].address, tokens[0].address]),
            4000
          )
  
          await snapshotGasCost(gasEstimate)
        })
  
        it('0 -> 2 cross 0 tick starting tick initialized', async () => {
          // Tick before 0, tick after 1. Tick 0 initialized.
          await createPoolWithZeroTickInitialized(nft, wallet, tokens[0].address, tokens[2].address)
          const {
            amountIn,
            sqrtPriceX96AfterList,
            initializedTicksCrossedList,
            gasEstimate,
          } = await quoter.callStatic.quoteExactOutput(
            encodePath([tokens[2].address, tokens[0].address]),
            100
          )
  
          await snapshotGasCost(gasEstimate)
        })
  
        it('0 -> 2 cross 0 tick starting tick not initialized', async () => {
          const {
            amountIn,
            sqrtPriceX96AfterList,
            initializedTicksCrossedList,
            gasEstimate,
          } = await quoter.callStatic.quoteExactOutput(
            encodePath([tokens[2].address, tokens[0].address]),
            10
          )
  
          await snapshotGasCost(gasEstimate)
        })
  
        it('2 -> 0 cross 2 ticks', async () => {
          const {
            amountIn,
            sqrtPriceX96AfterList,
            initializedTicksCrossedList,
            gasEstimate,
          } = await quoter.callStatic.quoteExactOutput(
            encodePath([tokens[0].address, tokens[2].address]),
            15000
          )
  
          await snapshotGasCost(gasEstimate)
        })
  
        it('2 -> 0 cross 2 where tick after is initialized', async () => {
          // The swap amount is set such that the active tick after the swap is 120.
          // 120 is an initialized tick for this pool. We check that we don't count it.
          const {
            amountIn,
            sqrtPriceX96AfterList,
            initializedTicksCrossedList,
            gasEstimate,
          } = await quoter.callStatic.quoteExactOutput(
            encodePath([tokens[0].address, tokens[2].address]),
            6223
          )
  
          await snapshotGasCost(gasEstimate)
        })
  
        it('2 -> 0 cross 1 tick', async () => {
          const {
            amountIn,
            sqrtPriceX96AfterList,
            initializedTicksCrossedList,
            gasEstimate,
          } = await quoter.callStatic.quoteExactOutput(
            encodePath([tokens[0].address, tokens[2].address]),
            6000
          )
  
          await snapshotGasCost(gasEstimate)
        })
  
        it('2 -> 1', async () => {
          const {
            amountIn,
            sqrtPriceX96AfterList,
            initializedTicksCrossedList,
            gasEstimate,
          } = await quoter.callStatic.quoteExactOutput(
            encodePath([tokens[1].address, tokens[2].address]),
            9899
          )
  
          await snapshotGasCost(gasEstimate)
        })
  
        it('0 -> 2 -> 1', async () => {
          const {
            amountIn,
            sqrtPriceX96AfterList,
            initializedTicksCrossedList,
            gasEstimate,
          } = await quoter.callStatic.quoteExactOutput(
            encodePath([tokens[0].address, tokens[2].address, tokens[1].address].reverse()),
            9795
          )
  
          await snapshotGasCost(gasEstimate)
        })       
      })
    })

    describe('#quoteExactOutputSingle', () => {
      it('0 -> 1', async () => {
        const {
          amountIn,
          sqrtPriceX96After,
          initializedTicksCrossed,
          gasEstimate,
        } = await quoter.callStatic.quoteExactOutputSingle({
          tokenIn: tokens[0].address,
          tokenOut: tokens[1].address,
          amount: MaxUint128,
          limitSqrtPrice: encodePriceSqrt(100, 102),
        })

        expect(amountIn).to.eq(9952)
        expect(initializedTicksCrossed).to.eq(0)
        expect(sqrtPriceX96After).to.eq('78447570448055484695608110440')
      })

      it('1 -> 0', async () => {
        const {
          amountIn,
          sqrtPriceX96After,
          initializedTicksCrossed,
          gasEstimate,
        } = await quoter.callStatic.quoteExactOutputSingle({
          tokenIn: tokens[1].address,
          tokenOut: tokens[0].address,
          amount: MaxUint128,
          limitSqrtPrice: encodePriceSqrt(102, 100),
        })

        expect(amountIn).to.eq(9952)
        expect(initializedTicksCrossed).to.eq(0)
        expect(sqrtPriceX96After).to.eq('80016521857016594389520272648')
      })

      describe('gas [ @skip-on-coverage ]', () => {
        it('0 -> 1', async () => {
          const {
            amountIn,
            sqrtPriceX96After,
            initializedTicksCrossed,
            gasEstimate,
          } = await quoter.callStatic.quoteExactOutputSingle({
            tokenIn: tokens[0].address,
            tokenOut: tokens[1].address,
            amount: MaxUint128,
            limitSqrtPrice: encodePriceSqrt(100, 102),
          })
  
          await snapshotGasCost(gasEstimate)
        })
  
        it('1 -> 0', async () => {
          const {
            amountIn,
            sqrtPriceX96After,
            initializedTicksCrossed,
            gasEstimate,
          } = await quoter.callStatic.quoteExactOutputSingle({
            tokenIn: tokens[1].address,
            tokenOut: tokens[0].address,
            amount: MaxUint128,
            limitSqrtPrice: encodePriceSqrt(102, 100),
          })
  
          await snapshotGasCost(gasEstimate)
        })
      })
    })
  })
})
