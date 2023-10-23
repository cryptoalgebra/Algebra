import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { MaxUint256 } from 'ethers';
import {
  PositionValueTest,
  SwapRouter,
  MockTimeNonfungiblePositionManager,
  IAlgebraPool,
  TestERC20,
  IAlgebraFactory,
} from '../typechain';
import { FeeAmount, MaxUint128, TICK_SPACINGS } from './shared/constants';
import { getMaxTick, getMinTick } from './shared/ticks';
import { encodePriceSqrt } from './shared/encodePriceSqrt';
import { expandTo18Decimals } from './shared/expandTo18Decimals';
import { encodePath } from './shared/path';
import completeFixture from './shared/completeFixture';
import snapshotGasCost from './shared/snapshotGasCost';

import { expect } from './shared/expect';

describe('PositionValue', async () => {
  let wallets: any;

  const positionValueCompleteFixture: () => Promise<{
    positionValue: PositionValueTest;
    tokens: [TestERC20, TestERC20, TestERC20];
    nft: MockTimeNonfungiblePositionManager;
    router: SwapRouter;
    factory: IAlgebraFactory;
  }> = async () => {
    const { nft, router, tokens, factory } = await loadFixture(completeFixture);
    const positionValueFactory = await ethers.getContractFactory('PositionValueTest');
    const positionValue = (await positionValueFactory.deploy()) as any as PositionValueTest;

    for (const token of tokens) {
      await token.approve(nft, MaxUint256);
      await token.connect(wallets[0]).approve(nft, MaxUint256);
      await token.transfer(wallets[0].address, expandTo18Decimals(1_000_000));
    }

    await nft.createAndInitializePoolIfNecessary(tokens[0], tokens[1], encodePriceSqrt(1, 1));

    return {
      positionValue,
      tokens,
      nft,
      router,
      factory,
    };
  };

  let pool: IAlgebraPool;
  let tokens: [TestERC20, TestERC20, TestERC20];
  let positionValue: PositionValueTest;
  let nft: MockTimeNonfungiblePositionManager;
  let router: SwapRouter;
  let factory: IAlgebraFactory;

  let amountDesired: bigint;

  before('create fixture loader', async () => {
    wallets = await (ethers as any).getSigners();
  });

  beforeEach(async () => {
    ({ positionValue, tokens, nft, router, factory } = await loadFixture(positionValueCompleteFixture));

    const poolAddress = await factory.poolByPair(await tokens[0].getAddress(), await tokens[1].getAddress());
    pool = (await ethers.getContractAt('IAlgebraPool', poolAddress, wallets[0])) as any as IAlgebraPool;
  });

  describe('#total', () => {
    let tokenId: number;
    let sqrtRatioX96: bigint;

    beforeEach(async () => {
      amountDesired = expandTo18Decimals(100_000);

      await nft.mint({
        token0: tokens[0],
        token1: tokens[1],
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallets[0].address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      });

      const swapAmount = expandTo18Decimals(1_000);
      await tokens[0].approve(router, swapAmount);
      await tokens[1].approve(router, swapAmount);

      // accumulate token0 fees
      await router.exactInput({
        recipient: wallets[0].address,
        deadline: 1,
        path: encodePath([await tokens[0].getAddress(), await tokens[1].getAddress()]),
        amountIn: swapAmount,
        amountOutMinimum: 0,
      });

      // accumulate token1 fees
      await router.exactInput({
        recipient: wallets[0].address,
        deadline: 1,
        path: encodePath([await tokens[1].getAddress(), await tokens[0].getAddress()]),
        amountIn: swapAmount,
        amountOutMinimum: 0,
      });

      sqrtRatioX96 = (await pool.globalState()).price;
    });

    it('returns the correct amount', async () => {
      const principal = await positionValue.principal(nft, 1, sqrtRatioX96);
      const fees = await positionValue.fees(nft, 1);
      const total = await positionValue.total(nft, 1, sqrtRatioX96);

      expect(total[0]).to.equal(principal[0] + fees[0]);
      expect(total[1]).to.equal(principal[1] + fees[1]);
    });

    it('gas', async () => {
      await snapshotGasCost(positionValue.totalGas(nft, 1, sqrtRatioX96));
    });
  });

  describe('#principal', () => {
    let sqrtRatioX96: bigint;

    beforeEach(async () => {
      amountDesired = expandTo18Decimals(100_000);
      sqrtRatioX96 = (await pool.globalState()).price;
    });

    it('returns the correct values when price is in the middle of the range', async () => {
      await nft.mint({
        token0: await tokens[0].getAddress(),
        token1: await tokens[1].getAddress(),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallets[0].address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      });

      const principal = await positionValue.principal(nft, 1, sqrtRatioX96);
      expect(principal.amount0).to.equal('99999999999999999999999');
      expect(principal.amount1).to.equal('99999999999999999999999');
    });

    it('returns the correct values when range is below current price', async () => {
      await nft.mint({
        token0: await tokens[0].getAddress(),
        token1: await tokens[1].getAddress(),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: -60,
        recipient: wallets[0].address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      });

      const principal = await positionValue.principal(nft, 1, sqrtRatioX96);
      expect(principal.amount0).to.equal('0');
      expect(principal.amount1).to.equal('99999999999999999999999');
    });

    it('returns the correct values when range is below current price', async () => {
      await nft.mint({
        token0: await tokens[0].getAddress(),
        token1: await tokens[1].getAddress(),
        tickLower: 60,
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallets[0].address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      });

      const principal = await positionValue.principal(nft, 1, sqrtRatioX96);
      expect(principal.amount0).to.equal('99999999999999999999999');
      expect(principal.amount1).to.equal('0');
    });

    it('returns the correct values when range is skewed above price', async () => {
      await nft.mint({
        token0: await tokens[0].getAddress(),
        token1: await tokens[1].getAddress(),
        tickLower: -6_000,
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallets[0].address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      });

      const principal = await positionValue.principal(nft, 1, sqrtRatioX96);
      expect(principal.amount0).to.equal('99999999999999999999999');
      expect(principal.amount1).to.equal('25917066770240321655335');
    });

    it('returns the correct values when range is skewed below price', async () => {
      await nft.mint({
        token0: await tokens[0].getAddress(),
        token1: await tokens[1].getAddress(),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: 6_000,
        recipient: wallets[0].address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      });

      const principal = await positionValue.principal(nft, 1, sqrtRatioX96);
      expect(principal.amount0).to.equal('25917066770240321655335');
      expect(principal.amount1).to.equal('99999999999999999999999');
    });

    it('gas', async () => {
      await nft.mint({
        token0: await tokens[0].getAddress(),
        token1: await tokens[1].getAddress(),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallets[0].address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      });

      await snapshotGasCost(positionValue.principalGas(nft, 1, sqrtRatioX96));
    });
  });

  describe('#fees', () => {
    let tokenId: number;

    beforeEach(async () => {
      amountDesired = expandTo18Decimals(100_000);
      tokenId = 2;

      await nft.mint({
        token0: await tokens[0].getAddress(),
        token1: await tokens[1].getAddress(),
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: wallets[0].address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 10,
      });
    });

    describe('when price is within the position range', () => {
      beforeEach(async () => {
        await nft.mint({
          token0: await tokens[0].getAddress(),
          token1: await tokens[1].getAddress(),
          tickLower: TICK_SPACINGS[FeeAmount.MEDIUM] * -1_000,
          tickUpper: TICK_SPACINGS[FeeAmount.MEDIUM] * 1_000,
          recipient: wallets[0].address,
          amount0Desired: amountDesired,
          amount1Desired: amountDesired,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10,
        });

        const swapAmount = expandTo18Decimals(1_000);
        await tokens[0].approve(router, swapAmount);
        await tokens[1].approve(router, swapAmount);

        // accumulate token0 fees
        await router.exactInput({
          recipient: wallets[0].address,
          deadline: 1,
          path: encodePath([await tokens[0].getAddress(), await tokens[1].getAddress()]),
          amountIn: swapAmount,
          amountOutMinimum: 0,
        });

        // accumulate token1 fees
        await router.exactInput({
          recipient: wallets[0].address,
          deadline: 1,
          path: encodePath([await tokens[1].getAddress(), await tokens[0].getAddress()]),
          amountIn: swapAmount,
          amountOutMinimum: 0,
        });
      });

      it('return the correct amount of fees', async () => {
        const feesFromCollect = await nft.collect.staticCall({
          tokenId,
          recipient: wallets[0].address,
          amount0Max: MaxUint128,
          amount1Max: MaxUint128,
        });
        const feeAmounts = await positionValue.fees(nft, tokenId);

        expect(feeAmounts[0]).to.equal(feesFromCollect[0]);
        expect(feeAmounts[1]).to.equal(feesFromCollect[1]);
      });

      it('returns the correct amount of fees if tokensOwed fields are greater than 0', async () => {
        await nft.increaseLiquidity({
          tokenId: tokenId,
          amount0Desired: 100,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: 1,
        });

        const swapAmount = expandTo18Decimals(1_000);
        await tokens[0].approve(router, swapAmount);

        // accumulate more token0 fees after clearing initial amount
        await router.exactInput({
          recipient: wallets[0].address,
          deadline: 1,
          path: encodePath([await tokens[0].getAddress(), await tokens[1].getAddress()]),
          amountIn: swapAmount,
          amountOutMinimum: 0,
        });

        const feesFromCollect = await nft.collect.staticCall({
          tokenId,
          recipient: wallets[0].address,
          amount0Max: MaxUint128,
          amount1Max: MaxUint128,
        });
        const feeAmounts = await positionValue.fees(nft, tokenId);
        expect(feeAmounts[0]).to.equal(feesFromCollect[0]);
        expect(feeAmounts[1]).to.equal(feesFromCollect[1]);
      });

      it('gas', async () => {
        await snapshotGasCost(positionValue.feesGas(nft, tokenId));
      });
    });

    describe('when price is below the position range', async () => {
      beforeEach(async () => {
        await nft.mint({
          token0: await tokens[0].getAddress(),
          token1: await tokens[1].getAddress(),
          tickLower: TICK_SPACINGS[FeeAmount.MEDIUM] * -10,
          tickUpper: TICK_SPACINGS[FeeAmount.MEDIUM] * 10,
          recipient: wallets[0].address,
          amount0Desired: expandTo18Decimals(10_000),
          amount1Desired: expandTo18Decimals(10_000),
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10,
        });

        await tokens[0].approve(router, MaxUint256);
        await tokens[1].approve(router, MaxUint256);

        // accumulate token1 fees
        await router.exactInput({
          recipient: wallets[0].address,
          deadline: 1,
          path: encodePath([await tokens[1].getAddress(), await tokens[0].getAddress()]),
          amountIn: expandTo18Decimals(1_000),
          amountOutMinimum: 0,
        });

        // accumulate token0 fees and push price below tickLower
        await router.exactInput({
          recipient: wallets[0].address,
          deadline: 1,
          path: encodePath([await tokens[0].getAddress(), await tokens[1].getAddress()]),
          amountIn: expandTo18Decimals(50_000),
          amountOutMinimum: 0,
        });
      });

      it('returns the correct amount of fees', async () => {
        const feesFromCollect = await nft.collect.staticCall({
          tokenId,
          recipient: wallets[0].address,
          amount0Max: MaxUint128,
          amount1Max: MaxUint128,
        });

        const feeAmounts = await positionValue.fees(nft, tokenId);
        expect(feeAmounts[0]).to.equal(feesFromCollect[0]);
        expect(feeAmounts[1]).to.equal(feesFromCollect[1]);
      });

      it('gas', async () => {
        await snapshotGasCost(positionValue.feesGas(nft, tokenId));
      });
    });

    describe('when price is above the position range', async () => {
      beforeEach(async () => {
        await nft.mint({
          token0: await tokens[0].getAddress(),
          token1: await tokens[1].getAddress(),
          tickLower: TICK_SPACINGS[FeeAmount.MEDIUM] * -10,
          tickUpper: TICK_SPACINGS[FeeAmount.MEDIUM] * 10,

          recipient: wallets[0].address,
          amount0Desired: expandTo18Decimals(10_000),
          amount1Desired: expandTo18Decimals(10_000),
          amount0Min: 0,
          amount1Min: 0,
          deadline: 10,
        });

        await tokens[0].approve(router, MaxUint256);
        await tokens[1].approve(router, MaxUint256);

        // accumulate token0 fees
        await router.exactInput({
          recipient: wallets[0].address,
          deadline: 1,
          path: encodePath([await tokens[0].getAddress(), await tokens[1].getAddress()]),
          amountIn: expandTo18Decimals(1_000),
          amountOutMinimum: 0,
        });

        // accumulate token1 fees and push price above tickUpper
        await router.exactInput({
          recipient: wallets[0].address,
          deadline: 1,
          path: encodePath([await tokens[1].getAddress(), await tokens[0].getAddress()]),
          amountIn: expandTo18Decimals(50_000),
          amountOutMinimum: 0,
        });
      });

      it('returns the correct amount of fees', async () => {
        const feesFromCollect = await nft.collect.staticCall({
          tokenId,
          recipient: wallets[0].address,
          amount0Max: MaxUint128,
          amount1Max: MaxUint128,
        });
        const feeAmounts = await positionValue.fees(nft, tokenId);
        expect(feeAmounts[0]).to.equal(feesFromCollect[0]);
        expect(feeAmounts[1]).to.equal(feesFromCollect[1]);
      });

      it('gas', async () => {
        await snapshotGasCost(positionValue.feesGas(nft, tokenId));
      });
    });
  });
});
