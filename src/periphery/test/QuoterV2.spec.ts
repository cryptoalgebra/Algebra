import { MaxUint256, Wallet } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { IAlgebraFactory, MockTimeNonfungiblePositionManager, QuoterV2, TestERC20 } from '../typechain';
import completeFixture from './shared/completeFixture';
import { MaxUint128 } from './shared/constants';
import { encodePriceSqrt } from './shared/encodePriceSqrt';
import { expandTo18Decimals } from './shared/expandTo18Decimals';
import { expect } from './shared/expect';
import { encodePath } from './shared/path';
import { createPool, createPoolWithMultiplePositions, createPoolWithZeroTickInitialized } from './shared/quoter';
import snapshotGasCost from './shared/snapshotGasCost';

type TestERC20WithAddress = TestERC20 & { address: string };

describe('QuoterV2', function () {
  this.timeout(40000);
  let wallet: Wallet;
  let trader: Wallet;

  const swapRouterFixture: () => Promise<{
    nft: MockTimeNonfungiblePositionManager;
    tokens: [TestERC20WithAddress, TestERC20WithAddress, TestERC20WithAddress];
    quoter: QuoterV2;
    factory: IAlgebraFactory;
  }> = async () => {
    const { wnative, factory, router, tokens, nft } = await loadFixture(completeFixture);
    let _tokens = tokens as [TestERC20WithAddress, TestERC20WithAddress, TestERC20WithAddress];
    // approve & fund wallets
    for (const token of _tokens) {
      await token.approve(router, MaxUint256);
      await token.approve(nft, MaxUint256);
      await token.connect(trader).approve(router, MaxUint256);
      await token.transfer(trader.address, expandTo18Decimals(1_000_000));
      token.address = await token.getAddress();
    }

    const quoterFactory = await ethers.getContractFactory('QuoterV2');
    quoter = (await quoterFactory.deploy(factory, wnative, await factory.poolDeployer())) as any as QuoterV2;

    return {
      tokens: _tokens,
      nft,
      quoter,
      factory,
    };
  };

  let nft: MockTimeNonfungiblePositionManager;
  let tokens: [TestERC20WithAddress, TestERC20WithAddress, TestERC20WithAddress];
  let quoter: QuoterV2;
  let factory: IAlgebraFactory;

  before('create fixture loader', async () => {
    const wallets = await (ethers as any).getSigners();
    [wallet, trader] = wallets;
  });

  describe('quotes', () => {
    const subFixture = async () => {
      const { tokens, nft, quoter, factory } = await swapRouterFixture();
      await createPool(nft, wallet, tokens[0].address, tokens[1].address);
      await createPool(nft, wallet, tokens[1].address, tokens[2].address);
      await createPoolWithMultiplePositions(nft, wallet, tokens[0].address, tokens[2].address);
      return {
        tokens,
        nft,
        quoter,
        factory,
      };
    };

    beforeEach(async () => {
      ({ tokens, nft, quoter, factory } = await loadFixture(subFixture));
    });

    describe('#quoteExactInput', () => {
      it('0 -> 2 cross 2 tick', async () => {
        const { amountOut, amountIn, sqrtPriceX96AfterList, initializedTicksCrossedList } =
          await quoter.quoteExactInput.staticCall(encodePath([tokens[0].address, tokens[2].address]), 10000);

        ////await snapshotGasCost(gasEstimate)
        expect(sqrtPriceX96AfterList.length).to.eq(1);
        expect(sqrtPriceX96AfterList[0]).to.eq('78459826284680823468887704103');
        expect(initializedTicksCrossedList[0]).to.eq(2);
        expect(amountIn).to.eq(10000);
        expect(amountOut).to.eq(9897);
      });

      it('0 -> 2 cross 2 tick where after is initialized', async () => {
        // The swap amount is set such that the active tick after the swap is -120.
        // -120 is an initialized tick for this pool. We check that we don't count it.
        const { amountOut, amountIn, sqrtPriceX96AfterList, initializedTicksCrossedList } =
          await quoter.quoteExactInput.staticCall(encodePath([tokens[0].address, tokens[2].address]), 6200);

        ////await snapshotGasCost(gasEstimate)
        expect(sqrtPriceX96AfterList.length).to.eq(1);
        expect(sqrtPriceX96AfterList[0]).to.eq('78755992497053066283316544500');
        expect(initializedTicksCrossedList.length).to.eq(1);
        expect(initializedTicksCrossedList[0]).to.eq(1);
        expect(amountOut).to.eq(6158);
        expect(amountIn).to.eq(6200);
      });

      it('0 -> 2 cross 1 tick', async () => {
        const { amountOut, amountIn, sqrtPriceX96AfterList, initializedTicksCrossedList } =
          await quoter.quoteExactInput.staticCall(encodePath([tokens[0].address, tokens[2].address]), 4000);

        ////await snapshotGasCost(gasEstimate)
        expect(initializedTicksCrossedList[0]).to.eq(1);
        expect(sqrtPriceX96AfterList.length).to.eq(1);
        expect(sqrtPriceX96AfterList[0]).to.eq('78925679077027744088480448931');
        expect(amountOut).to.eq(3981);
        expect(amountIn).to.eq(4000);
      });

      it('0 -> 2 cross 0 tick, starting tick not initialized', async () => {
        // Tick before 0, tick after -1.
        const { amountOut, amountIn, sqrtPriceX96AfterList, initializedTicksCrossedList } =
          await quoter.quoteExactInput.staticCall(encodePath([tokens[0].address, tokens[2].address]), 10);

        ////await snapshotGasCost(gasEstimate)
        expect(initializedTicksCrossedList[0]).to.eq(0);
        expect(sqrtPriceX96AfterList.length).to.eq(1);
        expect(sqrtPriceX96AfterList[0]).to.eq('79227483487511329217250071027');
        expect(amountOut).to.eq(8);
        expect(amountIn).to.eq(10);
      });

      it('0 -> 2 cross 0 tick, starting tick initialized', async () => {
        // Tick before 0, tick after -1. Tick 0 initialized.
        await createPoolWithZeroTickInitialized(nft, wallet, tokens[0].address, tokens[2].address);

        const { amountOut, amountIn, sqrtPriceX96AfterList, initializedTicksCrossedList } =
          await quoter.quoteExactInput.staticCall(encodePath([tokens[0].address, tokens[2].address]), 10);

        ////await snapshotGasCost(gasEstimate)
        expect(initializedTicksCrossedList[0]).to.eq(1);
        expect(sqrtPriceX96AfterList.length).to.eq(1);
        expect(sqrtPriceX96AfterList[0]).to.eq('79227817515327498931091950511');
        expect(amountOut).to.eq(8);
        expect(amountIn).to.eq(10);
      });

      it('2 -> 0 cross 2', async () => {
        const { amountOut, amountIn, sqrtPriceX96AfterList, initializedTicksCrossedList } =
          await quoter.quoteExactInput.staticCall(encodePath([tokens[2].address, tokens[0].address]), 10000);

        ////await snapshotGasCost(gasEstimate)
        expect(initializedTicksCrossedList[0]).to.eq(2);
        expect(sqrtPriceX96AfterList.length).to.eq(1);
        expect(sqrtPriceX96AfterList[0]).to.eq('80004022856373268738318816658');
        expect(initializedTicksCrossedList.length).to.eq(1);
        expect(amountOut).to.eq(9897);
        expect(amountIn).to.eq(10000);
      });

      it('2 -> 0 cross 2 where tick after is initialized', async () => {
        // The swap amount is set such that the active tick after the swap is 120.
        // 120 is an initialized tick for this pool. We check we don't count it.

        const { amountOut, amountIn, sqrtPriceX96AfterList, initializedTicksCrossedList } =
          await quoter.quoteExactInput.staticCall(encodePath([tokens[2].address, tokens[0].address]), 6250);

        ////await snapshotGasCost(gasEstimate)
        console.log(sqrtPriceX96AfterList[0].toString());
        expect(initializedTicksCrossedList[0]).to.eq(2);
        expect(sqrtPriceX96AfterList.length).to.eq(1);
        expect(sqrtPriceX96AfterList[0]).to.eq('79706996475107291736680620388');
        expect(initializedTicksCrossedList.length).to.eq(1);
        expect(amountOut).to.eq(6206);
        expect(amountIn).to.eq(6250);
      });

      it('2 -> 0 cross 0 tick, starting tick initialized', async () => {
        // Tick 0 initialized. Tick after = 1
        await createPoolWithZeroTickInitialized(nft, wallet, tokens[0].address, tokens[2].address);

        const { amountOut, amountIn, sqrtPriceX96AfterList, initializedTicksCrossedList } =
          await quoter.quoteExactInput.staticCall(encodePath([tokens[2].address, tokens[0].address]), 200);

        ////await snapshotGasCost(gasEstimate)
        expect(initializedTicksCrossedList[0]).to.eq(0);
        expect(sqrtPriceX96AfterList.length).to.eq(1);
        expect(sqrtPriceX96AfterList[0]).to.eq('79235729830182478001034429156');
        expect(initializedTicksCrossedList.length).to.eq(1);
        expect(amountOut).to.eq(198);
        expect(amountIn).to.eq(200);
      });

      it('2 -> 0 cross 0 tick, starting tick not initialized', async () => {
        // Tick 0 initialized. Tick after = 1
        const { amountOut, amountIn, sqrtPriceX96AfterList, initializedTicksCrossedList } =
          await quoter.quoteExactInput.staticCall(encodePath([tokens[2].address, tokens[0].address]), 103);

        ////await snapshotGasCost(gasEstimate)
        expect(initializedTicksCrossedList[0]).to.eq(0);
        expect(sqrtPriceX96AfterList.length).to.eq(1);
        expect(sqrtPriceX96AfterList[0]).to.eq('79235858216754624215638319723');
        expect(initializedTicksCrossedList.length).to.eq(1);
        expect(amountOut).to.eq(101);
        expect(amountIn).to.eq(103);
      });

      it('2 -> 1', async () => {
        const { amountOut, amountIn, sqrtPriceX96AfterList, initializedTicksCrossedList } =
          await quoter.quoteExactInput.staticCall(encodePath([tokens[2].address, tokens[1].address]), 10000);

        ////await snapshotGasCost(gasEstimate)
        expect(sqrtPriceX96AfterList.length).to.eq(1);
        expect(sqrtPriceX96AfterList[0]).to.eq('80020047998594409647791422119');
        expect(initializedTicksCrossedList[0]).to.eq(0);
        expect(amountOut).to.eq(9896);
        expect(amountIn).to.eq(10000);
      });

      it('0 -> 2 -> 1', async () => {
        const { amountOut, amountIn, sqrtPriceX96AfterList, initializedTicksCrossedList } =
          await quoter.quoteExactInput.staticCall(
            encodePath([tokens[0].address, tokens[2].address, tokens[1].address]),
            10000
          );

        ////await snapshotGasCost(gasEstimate)
        expect(sqrtPriceX96AfterList.length).to.eq(2);
        expect(sqrtPriceX96AfterList[0]).to.eq('78459826284680823468887704103');
        expect(sqrtPriceX96AfterList[1]).to.eq('80011887497855440421019287092');
        expect(initializedTicksCrossedList[0]).to.eq(2);
        expect(initializedTicksCrossedList[1]).to.eq(0);
        expect(amountOut).to.eq(9795);
        expect(amountIn).to.eq(10000);
      });
    });

    describe('#quoteExactInputSingle', () => {
      it('0 -> 2', async () => {
        const {
          amountOut: quote,
          amountIn,
          sqrtPriceX96After,
          initializedTicksCrossed,
          fee,
        } = await quoter.quoteExactInputSingle.staticCall({
          tokenIn: tokens[0].address,
          tokenOut: tokens[2].address,
          amountIn: MaxUint128,
          // -2%
          limitSqrtPrice: encodePriceSqrt(100, 102),
        });

        expect(initializedTicksCrossed).to.eq(2);
        expect(quote).to.eq(10051);
        expect(amountIn).to.be.eq(10158);
        expect(sqrtPriceX96After).to.eq(encodePriceSqrt(100, 102));
        expect(fee).to.be.eq(500);
      });

      it('0 -> 2, bubbles custom error', async () => {
        const pool = await ethers.getContractAt(
          'IAlgebraPool',
          await factory.poolByPair(tokens[0].address, tokens[2].address)
        );

        await expect(
          quoter.quoteExactInputSingle.staticCall({
            tokenIn: tokens[0].address,
            tokenOut: tokens[2].address,
            amountIn: MaxUint128,
            // +2%
            limitSqrtPrice: encodePriceSqrt(104, 102),
          })
        ).to.be.revertedWithCustomError(pool, 'invalidLimitSqrtPrice');
      });

      it('2 -> 0', async () => {
        const {
          fee,
          amountIn,
          amountOut: quote,
          sqrtPriceX96After,
          initializedTicksCrossed,
        } = await quoter.quoteExactInputSingle.staticCall({
          tokenIn: tokens[2].address,
          tokenOut: tokens[0].address,
          amountIn: MaxUint128,
          // +2%
          limitSqrtPrice: encodePriceSqrt(102, 100),
        });

        expect(initializedTicksCrossed).to.eq(2);
        expect(quote).to.eq(10051);
        expect(amountIn).to.be.eq(10158);
        expect(sqrtPriceX96After).to.eq(encodePriceSqrt(102, 100));
        expect(fee).to.be.eq(500);
      });

      describe('gas [ @skip-on-coverage ]', () => {
        it('0 -> 2', async () => {
          const { gasEstimate } = await quoter.quoteExactInputSingle.staticCall({
            tokenIn: tokens[0].address,
            tokenOut: tokens[2].address,
            amountIn: 10000,
            // -2%
            limitSqrtPrice: encodePriceSqrt(100, 102),
          });

          await snapshotGasCost(gasEstimate);
        });

        it('2 -> 0', async () => {
          const { gasEstimate } = await quoter.quoteExactInputSingle.staticCall({
            tokenIn: tokens[2].address,
            tokenOut: tokens[0].address,
            amountIn: 10000,
            // +2%
            limitSqrtPrice: encodePriceSqrt(102, 100),
          });

          await snapshotGasCost(gasEstimate);
        });
      });
    });

    describe('#quoteExactOutput', () => {
      it('0 -> 2 cross 2 tick', async () => {
        const { amountOut, amountIn, sqrtPriceX96AfterList, initializedTicksCrossedList } =
          await quoter.quoteExactOutput.staticCall(encodePath([tokens[2].address, tokens[0].address]), 15000);

        expect(initializedTicksCrossedList.length).to.eq(1);
        expect(initializedTicksCrossedList[0]).to.eq(2);
        expect(amountIn).to.eq(15234);
        expect(amountOut).to.be.eq(15000);

        expect(sqrtPriceX96AfterList.length).to.eq(1);
        expect(sqrtPriceX96AfterList[0]).to.eq('78055527257643669242286029831');
      });

      it('0 -> 2 cross 2 where tick after is initialized', async () => {
        // The swap amount is set such that the active tick after the swap is -120.
        // -120 is an initialized tick for this pool. We check that we count it.
        const { amountOut, amountIn, sqrtPriceX96AfterList, initializedTicksCrossedList } =
          await quoter.quoteExactOutput.staticCall(encodePath([tokens[2].address, tokens[0].address]), 6158);

        expect(sqrtPriceX96AfterList.length).to.eq(1);
        expect(sqrtPriceX96AfterList[0]).to.eq('78756056567076985409608047254');
        expect(initializedTicksCrossedList.length).to.eq(1);
        expect(initializedTicksCrossedList[0]).to.eq(1);
        expect(amountIn).to.eq(6200);
        expect(amountOut).to.be.eq(6158);
      });

      it('0 -> 2 cross 1 tick', async () => {
        const { amountOut, amountIn, sqrtPriceX96AfterList, initializedTicksCrossedList } =
          await quoter.quoteExactOutput.staticCall(encodePath([tokens[2].address, tokens[0].address]), 4000);

        expect(initializedTicksCrossedList.length).to.eq(1);
        expect(initializedTicksCrossedList[0]).to.eq(1);
        expect(amountIn).to.eq(4019);
        expect(amountOut).to.be.eq(4000);

        expect(sqrtPriceX96AfterList.length).to.eq(1);
        expect(sqrtPriceX96AfterList[0]).to.eq('78924219757724709840818372098');
      });

      it('0 -> 2 cross 0 tick starting tick initialized', async () => {
        // Tick before 0, tick after 1. Tick 0 initialized.
        await createPoolWithZeroTickInitialized(nft, wallet, tokens[0].address, tokens[2].address);
        const { amountOut, amountIn, sqrtPriceX96AfterList, initializedTicksCrossedList } =
          await quoter.quoteExactOutput.staticCall(encodePath([tokens[2].address, tokens[0].address]), 100);

        expect(initializedTicksCrossedList.length).to.eq(1);
        expect(initializedTicksCrossedList[0]).to.eq(1);
        expect(amountIn).to.eq(102);
        expect(amountOut).to.be.eq(100);

        expect(sqrtPriceX96AfterList.length).to.eq(1);
        expect(sqrtPriceX96AfterList[0]).to.eq('79224329176051641448521403903');
      });

      it('0 -> 2 cross 0 tick starting tick not initialized', async () => {
        const { amountOut, amountIn, sqrtPriceX96AfterList, initializedTicksCrossedList } =
          await quoter.quoteExactOutput.staticCall(encodePath([tokens[2].address, tokens[0].address]), 10);

        expect(initializedTicksCrossedList.length).to.eq(1);
        expect(initializedTicksCrossedList[0]).to.eq(0);
        expect(amountIn).to.eq(12);
        expect(amountOut).to.be.eq(10);

        expect(sqrtPriceX96AfterList.length).to.eq(1);
        expect(sqrtPriceX96AfterList[0]).to.eq('79227408033628034983534698435');
      });

      it('2 -> 0 cross 2 ticks', async () => {
        const { amountOut, amountIn, sqrtPriceX96AfterList, initializedTicksCrossedList } =
          await quoter.quoteExactOutput.staticCall(encodePath([tokens[0].address, tokens[2].address]), 15000);

        expect(initializedTicksCrossedList.length).to.eq(1);
        expect(initializedTicksCrossedList[0]).to.eq(2);
        expect(amountIn).to.eq(15234);
        expect(amountOut).to.be.eq(15000);
        expect(sqrtPriceX96AfterList.length).to.eq(1);
        expect(sqrtPriceX96AfterList[0]).to.eq('80418414376567919517220409857');
      });

      it('2 -> 0 cross 2 where tick after is initialized', async () => {
        // The swap amount is set such that the active tick after the swap is 120.
        // 120 is an initialized tick for this pool. We check that we don't count it.
        const { amountOut, amountIn, sqrtPriceX96AfterList, initializedTicksCrossedList } =
          await quoter.quoteExactOutput.staticCall(encodePath([tokens[0].address, tokens[2].address]), 6223);

        expect(initializedTicksCrossedList[0]).to.eq(2);
        expect(sqrtPriceX96AfterList.length).to.eq(1);
        expect(sqrtPriceX96AfterList[0]).to.eq('79708304437530892332449657932');
        expect(initializedTicksCrossedList.length).to.eq(1);
        expect(amountIn).to.eq(6267);
        expect(amountOut).to.be.eq(6223);
      });

      it('2 -> 0 cross 1 tick', async () => {
        const { amountOut, amountIn, sqrtPriceX96AfterList, initializedTicksCrossedList } =
          await quoter.quoteExactOutput.staticCall(encodePath([tokens[0].address, tokens[2].address]), 6000);

        expect(initializedTicksCrossedList[0]).to.eq(1);
        expect(sqrtPriceX96AfterList.length).to.eq(1);
        expect(sqrtPriceX96AfterList[0]).to.eq('79690640184021170956740081887');
        expect(initializedTicksCrossedList.length).to.eq(1);
        expect(amountIn).to.eq(6040);
        expect(amountOut).to.be.eq(6000);
      });

      it('2 -> 1', async () => {
        const { amountOut, amountIn, sqrtPriceX96AfterList, initializedTicksCrossedList } =
          await quoter.quoteExactOutput.staticCall(encodePath([tokens[1].address, tokens[2].address]), 9897);

        expect(sqrtPriceX96AfterList.length).to.eq(1);
        expect(sqrtPriceX96AfterList[0]).to.eq('80020121658316697953186638498');
        expect(initializedTicksCrossedList[0]).to.eq(0);
        expect(amountIn).to.eq(10002);
        expect(amountOut).to.be.eq(9897);
      });

      it('0 -> 2 -> 1', async () => {
        const { amountOut, amountIn, sqrtPriceX96AfterList, initializedTicksCrossedList } =
          await quoter.quoteExactOutput.staticCall(
            encodePath([tokens[0].address, tokens[2].address, tokens[1].address].reverse()),
            9795
          );

        expect(sqrtPriceX96AfterList.length).to.eq(2);
        expect(sqrtPriceX96AfterList[0]).to.eq('80011878867774185742895612865');
        expect(sqrtPriceX96AfterList[1]).to.eq('78459828570953960157025884610');
        expect(initializedTicksCrossedList[0]).to.eq(0);
        expect(initializedTicksCrossedList[1]).to.eq(2);
        expect(amountIn).to.eq(10000);
        expect(amountOut).to.be.eq(9795);
      });

      describe('gas [ @skip-on-coverage ]', () => {
        it('0 -> 2 cross 2 tick', async () => {
          const { gasEstimate } = await quoter.quoteExactOutput.staticCall(
            encodePath([tokens[2].address, tokens[0].address]),
            15000
          );

          await snapshotGasCost(gasEstimate);
        });

        it('0 -> 2 cross 2 where tick after is initialized', async () => {
          // The swap amount is set such that the active tick after the swap is -120.
          // -120 is an initialized tick for this pool. We check that we count it.
          const { gasEstimate } = await quoter.quoteExactOutput.staticCall(
            encodePath([tokens[2].address, tokens[0].address]),
            6158
          );

          await snapshotGasCost(gasEstimate);
        });

        it('0 -> 2 cross 1 tick', async () => {
          const { gasEstimate } = await quoter.quoteExactOutput.staticCall(
            encodePath([tokens[2].address, tokens[0].address]),
            4000
          );

          await snapshotGasCost(gasEstimate);
        });

        it('0 -> 2 cross 0 tick starting tick initialized', async () => {
          // Tick before 0, tick after 1. Tick 0 initialized.
          await createPoolWithZeroTickInitialized(nft, wallet, tokens[0].address, tokens[2].address);
          const { gasEstimate } = await quoter.quoteExactOutput.staticCall(
            encodePath([tokens[2].address, tokens[0].address]),
            100
          );

          await snapshotGasCost(gasEstimate);
        });

        it('0 -> 2 cross 0 tick starting tick not initialized', async () => {
          const { gasEstimate } = await quoter.quoteExactOutput.staticCall(
            encodePath([tokens[2].address, tokens[0].address]),
            10
          );

          await snapshotGasCost(gasEstimate);
        });

        it('2 -> 0 cross 2 ticks', async () => {
          const { gasEstimate } = await quoter.quoteExactOutput.staticCall(
            encodePath([tokens[0].address, tokens[2].address]),
            15000
          );

          await snapshotGasCost(gasEstimate);
        });

        it('2 -> 0 cross 2 where tick after is initialized', async () => {
          // The swap amount is set such that the active tick after the swap is 120.
          // 120 is an initialized tick for this pool. We check that we don't count it.
          const { gasEstimate } = await quoter.quoteExactOutput.staticCall(
            encodePath([tokens[0].address, tokens[2].address]),
            6223
          );

          await snapshotGasCost(gasEstimate);
        });

        it('2 -> 0 cross 1 tick', async () => {
          const { gasEstimate } = await quoter.quoteExactOutput.staticCall(
            encodePath([tokens[0].address, tokens[2].address]),
            6000
          );

          await snapshotGasCost(gasEstimate);
        });

        it('2 -> 1', async () => {
          const { gasEstimate } = await quoter.quoteExactOutput.staticCall(
            encodePath([tokens[1].address, tokens[2].address]),
            9897
          );

          await snapshotGasCost(gasEstimate);
        });

        it('0 -> 2 -> 1', async () => {
          const { gasEstimate } = await quoter.quoteExactOutput.staticCall(
            encodePath([tokens[0].address, tokens[2].address, tokens[1].address].reverse()),
            9795
          );

          await snapshotGasCost(gasEstimate);
        });
      });
    });

    describe('#quoteExactOutputSingle', () => {
      it('0 -> 1', async () => {
        const { amountOut, amountIn, sqrtPriceX96After, initializedTicksCrossed } =
          await quoter.quoteExactOutputSingle.staticCall({
            tokenIn: tokens[0].address,
            tokenOut: tokens[1].address,
            amount: MaxUint128,
            limitSqrtPrice: encodePriceSqrt(100, 102),
          });

        expect(amountIn).to.eq(9956);
        expect(amountOut).to.be.eq(9852);
        expect(initializedTicksCrossed).to.eq(0);
        expect(sqrtPriceX96After).to.eq('78447570448055484695608110440');
      });

      it('1 -> 0', async () => {
        const { amountOut, amountIn, sqrtPriceX96After, initializedTicksCrossed } =
          await quoter.quoteExactOutputSingle.staticCall({
            tokenIn: tokens[1].address,
            tokenOut: tokens[0].address,
            amount: MaxUint128,
            limitSqrtPrice: encodePriceSqrt(102, 100),
          });

        expect(amountIn).to.eq(9956);
        expect(amountOut).to.be.eq(9852);
        expect(initializedTicksCrossed).to.eq(0);
        expect(sqrtPriceX96After).to.eq('80016521857016594389520272648');
      });

      describe('gas [ @skip-on-coverage ]', () => {
        it('0 -> 1', async () => {
          const { gasEstimate } = await quoter.quoteExactOutputSingle.staticCall({
            tokenIn: tokens[0].address,
            tokenOut: tokens[1].address,
            amount: MaxUint128,
            limitSqrtPrice: encodePriceSqrt(100, 102),
          });

          await snapshotGasCost(gasEstimate);
        });

        it('1 -> 0', async () => {
          const { gasEstimate } = await quoter.quoteExactOutputSingle.staticCall({
            tokenIn: tokens[1].address,
            tokenOut: tokens[0].address,
            amount: MaxUint128,
            limitSqrtPrice: encodePriceSqrt(102, 100),
          });

          await snapshotGasCost(gasEstimate);
        });
      });
    });
  });
});
