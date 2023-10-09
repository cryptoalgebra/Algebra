import { BigNumberish, Contract, Wallet, MaxUint256 } from 'ethers';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { MockTimeNonfungiblePositionManager, TestERC20, TickLensTest } from '../typechain';
import completeFixture from './shared/completeFixture';
import { FeeAmount, TICK_SPACINGS } from './shared/constants';
import { encodePriceSqrt } from './shared/encodePriceSqrt';
import { expect } from './shared/expect';
import { getMaxTick, getMinTick } from './shared/ticks';
import { computePoolAddress } from './shared/computePoolAddress';
import snapshotGasCost from './shared/snapshotGasCost';

type TestERC20WithAddress = TestERC20 & { address: string };

describe('TickLens', () => {
  let wallets: Wallet[];

  async function nftFixture(): Promise<{
    factory: Contract;
    nft: MockTimeNonfungiblePositionManager;
    tokens: [TestERC20WithAddress, TestERC20WithAddress, TestERC20WithAddress];
  }> {
    const { factory, tokens, nft } = await loadFixture(completeFixture);
    let _tokens = tokens as [TestERC20WithAddress, TestERC20WithAddress, TestERC20WithAddress];

    for (const token of _tokens) {
      await token.approve(nft, MaxUint256);
      token.address = await token.getAddress();
    }

    _tokens.sort((tokenA: TestERC20WithAddress, tokenB: TestERC20WithAddress) => {
      if (!tokenA.address || !tokenB.address) return 0;
      return tokenA.address.toLowerCase() < tokenB.address.toLowerCase() ? -1 : 1;
    });

    return {
      factory: factory as any as Contract,
      nft,
      tokens: _tokens,
    };
  }

  let nft: MockTimeNonfungiblePositionManager;
  let tokens: [TestERC20WithAddress, TestERC20WithAddress, TestERC20WithAddress];
  let poolAddress: string;
  let tickLens: TickLensTest;

  before('create fixture loader', async () => {
    wallets = await (ethers as any).getSigners();
  });

  async function mint(tickLower: number, tickUpper: number, amountBothDesired: BigNumberish): Promise<number> {
    const mintParams = {
      token0: tokens[0].address,
      token1: tokens[1].address,
      tickLower,
      tickUpper,
      amount0Desired: amountBothDesired,
      amount1Desired: amountBothDesired,
      amount0Min: 0,
      amount1Min: 0,
      recipient: wallets[0].address,
      deadline: 1,
    };

    const { liquidity } = await nft.mint.staticCall(mintParams);

    await nft.mint(mintParams);
    return Number(liquidity);
  }

  async function subFixture() {
    const { factory, tokens: _tokens, nft: _nft } = await nftFixture();

    let [tokenAddressA, tokenAddressB] = [_tokens[0].address, _tokens[1].address];

    if (BigInt(tokenAddressA) > BigInt(tokenAddressB)) [tokenAddressA, tokenAddressB] = [tokenAddressB, tokenAddressA];

    const tx = await _nft.createAndInitializePoolIfNecessary(tokenAddressA, tokenAddressB, encodePriceSqrt(1, 1));
    await tx.wait();

    const liquidityParams = {
      token0: tokenAddressA,
      token1: tokenAddressB,
      tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      recipient: wallets[0].address,
      amount0Desired: 1000000,
      amount1Desired: 1000000,
      amount0Min: 0,
      amount1Min: 0,
      deadline: 1,
    };

    await _nft.mint(liquidityParams);

    const _poolAddress = computePoolAddress(await factory.poolDeployer(), [tokenAddressA, tokenAddressB]);
    const lensFactory = await ethers.getContractFactory('TickLensTest');
    const _tickLens = (await lensFactory.deploy()) as any as TickLensTest;

    return {
      factory,
      nft: _nft,
      tokens: _tokens,
      poolAddress: _poolAddress,
      tickLens: _tickLens,
    };
  }

  function getTickTableIndex(tick: BigNumberish): bigint {
    const intermediate = BigInt(tick);
    // see https://docs.soliditylang.org/en/v0.7.6/types.html#shifts
    return intermediate >> 8n;
  }

  describe('#getPopulatedTicksInWord', () => {
    const fullRangeLiquidity = 1000000;

    beforeEach('load fixture', async () => {
      ({ nft, tokens, poolAddress, tickLens } = await loadFixture(subFixture));
    });

    it('works for min/max', async () => {
      const res = await tickLens.getPopulatedTicksInWord(
        poolAddress,
        getTickTableIndex(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]))
      );
      const [min] = res;

      const [max] = await tickLens.getPopulatedTicksInWord(
        poolAddress,
        getTickTableIndex(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]))
      );

      expect(min.tick).to.be.eq(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]));
      expect(min.liquidityNet).to.be.eq(fullRangeLiquidity);
      expect(min.liquidityGross).to.be.eq(fullRangeLiquidity);

      expect(max.tick).to.be.eq(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]));
      expect(max.liquidityNet).to.be.eq(fullRangeLiquidity * -1);
      expect(min.liquidityGross).to.be.eq(fullRangeLiquidity);
    });

    it('works for min/max and -2/-1/0/1', async () => {
      const minus = -TICK_SPACINGS[FeeAmount.MEDIUM];
      const plus = -minus;

      const liquidity0 = await mint(minus * 2, minus, 2);
      const liquidity1 = await mint(minus * 2, 0, 3);
      const liquidity2 = await mint(minus * 2, plus, 5);
      const liquidity3 = await mint(minus, 0, 7);
      const liquidity4 = await mint(minus, plus, 11);
      const liquidity5 = await mint(0, plus, 13);

      const [min] = await tickLens.getPopulatedTicksInWord(
        poolAddress,
        getTickTableIndex(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]))
      );

      const [negativeOne, negativeTwo] = await tickLens.getPopulatedTicksInWord(poolAddress, getTickTableIndex(minus));

      const [one, zero] = await tickLens.getPopulatedTicksInWord(poolAddress, getTickTableIndex(plus));

      const [max] = await tickLens.getPopulatedTicksInWord(
        poolAddress,
        getTickTableIndex(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]))
      );

      expect(min.tick).to.be.eq(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]));
      expect(min.liquidityNet).to.be.eq(fullRangeLiquidity);
      expect(min.liquidityGross).to.be.eq(fullRangeLiquidity);

      expect(negativeTwo.tick).to.be.eq(minus * 2);
      expect(negativeTwo.liquidityNet).to.be.eq(liquidity0 + liquidity1 + liquidity2);
      expect(negativeTwo.liquidityGross).to.be.eq(liquidity0 + liquidity1 + liquidity2);

      expect(negativeOne.tick).to.be.eq(minus);
      expect(negativeOne.liquidityNet).to.be.eq(liquidity3 + liquidity4 - liquidity0);
      expect(negativeOne.liquidityGross).to.be.eq(liquidity3 + liquidity4 + liquidity0);

      expect(zero.tick).to.be.eq(0);
      expect(zero.liquidityNet).to.be.eq(liquidity5 - liquidity1 - liquidity3);
      expect(zero.liquidityGross).to.be.eq(liquidity5 + liquidity1 + liquidity3);

      expect(one.tick).to.be.eq(plus);
      expect(one.liquidityNet).to.be.eq(-liquidity2 - liquidity4 - liquidity5);
      expect(one.liquidityGross).to.be.eq(liquidity2 + liquidity4 + liquidity5);

      expect(max.tick).to.be.eq(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]));
      expect(max.liquidityNet).to.be.eq(fullRangeLiquidity * -1);
      expect(max.liquidityGross).to.be.eq(fullRangeLiquidity);
    });

    it('gas for single populated tick [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(
        tickLens.getGasCostOfGetPopulatedTicksInWord(
          poolAddress,
          getTickTableIndex(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]))
        )
      );
    });
  });

  describe('#getNextActiveTicks', () => {
    const fullRangeLiquidity = 1000000;

    beforeEach('load fixture', async () => {
      ({ nft, tokens, poolAddress, tickLens } = await loadFixture(subFixture));
    });

    it('works for min/max', async () => {
      const res = await tickLens.getNextActiveTicks(poolAddress, getMinTick(1), 256, true);
      const [min, first, second, max] = res;

      expect(min.tick).to.be.eq(getMinTick(1));
      expect(min.liquidityNet).to.be.eq(0);
      expect(min.liquidityGross).to.be.eq(0);

      expect(first.tick).to.be.eq(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]));
      expect(first.liquidityNet).to.be.eq(fullRangeLiquidity);
      expect(first.liquidityGross).to.be.eq(fullRangeLiquidity);

      expect(second.tick).to.be.eq(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]));
      expect(second.liquidityNet).to.be.eq(fullRangeLiquidity * -1);
      expect(second.liquidityGross).to.be.eq(fullRangeLiquidity);

      expect(max.tick).to.be.eq(getMaxTick(1));
      expect(max.liquidityNet).to.be.eq(0);
      expect(max.liquidityGross).to.be.eq(0);
    });

    it('reverts on invalid tick', async () => {
      await expect(tickLens.getNextActiveTicks(poolAddress, getMinTick(1) + 1, 256, true)).to.be.revertedWith(
        'Invalid startingTick'
      );
    });

    it('works for min/max and -2/-1/0/1', async () => {
      const minus = -TICK_SPACINGS[FeeAmount.MEDIUM];
      const plus = -minus;

      const liquidity0 = await mint(minus * 2, minus, 2);
      const liquidity1 = await mint(minus * 2, 0, 3);
      const liquidity2 = await mint(minus * 2, plus, 5);
      const liquidity3 = await mint(minus, 0, 7);
      const liquidity4 = await mint(minus, plus, 11);
      const liquidity5 = await mint(0, plus, 13);

      const [gMin, min, negativeTwo, negativeOne, zero, one, max, gMax] = await tickLens.getNextActiveTicks(
        poolAddress,
        getMinTick(1),
        256,
        true
      );

      expect(gMin.tick).to.be.eq(getMinTick(1));
      expect(gMin.liquidityNet).to.be.eq(0);
      expect(gMin.liquidityGross).to.be.eq(0);

      expect(min.tick).to.be.eq(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]));
      expect(min.liquidityNet).to.be.eq(fullRangeLiquidity);
      expect(min.liquidityGross).to.be.eq(fullRangeLiquidity);

      expect(negativeTwo.tick).to.be.eq(minus * 2);
      expect(negativeTwo.liquidityNet).to.be.eq(liquidity0 + liquidity1 + liquidity2);
      expect(negativeTwo.liquidityGross).to.be.eq(liquidity0 + liquidity1 + liquidity2);

      expect(negativeOne.tick).to.be.eq(minus);
      expect(negativeOne.liquidityNet).to.be.eq(liquidity3 + liquidity4 - liquidity0);
      expect(negativeOne.liquidityGross).to.be.eq(liquidity3 + liquidity4 + liquidity0);

      expect(zero.tick).to.be.eq(0);
      expect(zero.liquidityNet).to.be.eq(liquidity5 - liquidity1 - liquidity3);
      expect(zero.liquidityGross).to.be.eq(liquidity5 + liquidity1 + liquidity3);

      expect(one.tick).to.be.eq(plus);
      expect(one.liquidityNet).to.be.eq(-liquidity2 - liquidity4 - liquidity5);
      expect(one.liquidityGross).to.be.eq(liquidity2 + liquidity4 + liquidity5);

      expect(max.tick).to.be.eq(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]));
      expect(max.liquidityNet).to.be.eq(fullRangeLiquidity * -1);
      expect(max.liquidityGross).to.be.eq(fullRangeLiquidity);

      expect(gMax.tick).to.be.eq(getMaxTick(1));
      expect(gMax.liquidityNet).to.be.eq(0);
      expect(gMax.liquidityGross).to.be.eq(0);
    });

    it('gas for single populated tick [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(
        tickLens.getGasCostOfGetNextActiveTicks(poolAddress, getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]), 1, true)
      );
    });
  });

  describe('#getClosestActiveTicks', () => {
    const fullRangeLiquidity = 1000000;

    beforeEach('load fixture', async () => {
      ({ nft, tokens, poolAddress, tickLens } = await loadFixture(subFixture));
    });

    it('works for next leaf', async () => {
      const liquidity = await mint(300, 360, 2);

      const [low0, top0] = await tickLens.getClosestActiveTicks(poolAddress, 0);

      expect(low0.tick).to.be.eq(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]));
      expect(low0.liquidityNet).to.be.eq(fullRangeLiquidity);
      expect(low0.liquidityGross).to.be.eq(fullRangeLiquidity);

      expect(top0.tick).to.be.eq(300);
      expect(top0.liquidityNet).to.be.eq(liquidity);
      expect(top0.liquidityGross).to.be.eq(liquidity);
    });

    it('works for high ticks', async () => {
      const liquidity = await mint(32820, 32880, 2);

      const [low0, top0] = await tickLens.getClosestActiveTicks(poolAddress, 30269);

      expect(top0.tick).to.be.eq(32820);
      expect(top0.liquidityNet).to.be.eq(liquidity);
      expect(top0.liquidityGross).to.be.eq(liquidity);

      expect(low0.tick).to.be.eq(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]));
      expect(low0.liquidityNet).to.be.eq(fullRangeLiquidity);
      expect(low0.liquidityGross).to.be.eq(fullRangeLiquidity);
    });

    it('works for min/max', async () => {
      const [low0, top0] = await tickLens.getClosestActiveTicks(poolAddress, 0);

      expect(low0.tick).to.be.eq(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]));
      expect(low0.liquidityNet).to.be.eq(fullRangeLiquidity);
      expect(low0.liquidityGross).to.be.eq(fullRangeLiquidity);

      expect(top0.tick).to.be.eq(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]));
      expect(top0.liquidityNet).to.be.eq(fullRangeLiquidity * -1);
      expect(top0.liquidityGross).to.be.eq(fullRangeLiquidity);

      const [low0_1, top0_1] = await tickLens.getClosestActiveTicks(
        poolAddress,
        getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM])
      );

      expect(low0_1.tick).to.be.eq(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]));
      expect(low0_1.liquidityNet).to.be.eq(fullRangeLiquidity);
      expect(low0_1.liquidityGross).to.be.eq(fullRangeLiquidity);

      expect(top0_1.tick).to.be.eq(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]));
      expect(top0_1.liquidityNet).to.be.eq(fullRangeLiquidity * -1);
      expect(top0_1.liquidityGross).to.be.eq(fullRangeLiquidity);

      const [low0_2, top0_2] = await tickLens.getClosestActiveTicks(
        poolAddress,
        getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]) - 1
      );

      expect(low0_2.tick).to.be.eq(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]));
      expect(low0_2.liquidityNet).to.be.eq(fullRangeLiquidity);
      expect(low0_2.liquidityGross).to.be.eq(fullRangeLiquidity);

      expect(top0_2.tick).to.be.eq(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]));
      expect(top0_2.liquidityNet).to.be.eq(fullRangeLiquidity * -1);
      expect(top0_2.liquidityGross).to.be.eq(fullRangeLiquidity);

      const [low0_3, top0_3] = await tickLens.getClosestActiveTicks(
        poolAddress,
        getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]) + 1
      );

      expect(low0_3.tick).to.be.eq(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]));
      expect(low0_3.liquidityNet).to.be.eq(fullRangeLiquidity);
      expect(low0_3.liquidityGross).to.be.eq(fullRangeLiquidity);

      expect(top0_3.tick).to.be.eq(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]));
      expect(top0_3.liquidityNet).to.be.eq(fullRangeLiquidity * -1);
      expect(top0_3.liquidityGross).to.be.eq(fullRangeLiquidity);

      const [low1, top1] = await tickLens.getClosestActiveTicks(
        poolAddress,
        getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])
      );

      expect(low1.tick).to.be.eq(getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]));
      expect(low1.liquidityNet).to.be.eq(fullRangeLiquidity * -1);
      expect(low1.liquidityGross).to.be.eq(fullRangeLiquidity);

      expect(top1.tick).to.be.eq(getMaxTick(1));
      expect(top1.liquidityNet).to.be.eq(0);
      expect(top1.liquidityGross).to.be.eq(0);

      const [low2, top2] = await tickLens.getClosestActiveTicks(
        poolAddress,
        getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]) - 1
      );

      expect(low2.tick).to.be.eq(getMinTick(1));
      expect(low2.liquidityNet).to.be.eq(0);
      expect(low2.liquidityGross).to.be.eq(0);

      expect(top2.tick).to.be.eq(getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]));
      expect(top2.liquidityNet).to.be.eq(fullRangeLiquidity);
      expect(top2.liquidityGross).to.be.eq(fullRangeLiquidity);
    });

    it('gas for almost all tick space [ @skip-on-coverage ]', async () => {
      await snapshotGasCost(tickLens.getGasCostOfGetClosestActiveTicks(poolAddress, 0));
    });
  });

  describe('fully populated word', () => {
    async function fullFixture() {
      const res = await subFixture();

      // fully populate a word
      for (let i = 0; i < 128; i++) {
        await mint(i * TICK_SPACINGS[FeeAmount.MEDIUM], (255 - i) * TICK_SPACINGS[FeeAmount.MEDIUM], 100);
      }

      return res;
    }

    beforeEach('load fixture', async () => {
      ({ nft, tokens, poolAddress, tickLens } = await loadFixture(fullFixture));
    });

    it('getPopulatedTicksInWord [ @skip-on-coverage ]', async () => {
      const ticks = await tickLens.getPopulatedTicksInWord(poolAddress, getTickTableIndex(0));
      expect(ticks.length).to.be.eq(5);

      await snapshotGasCost(tickLens.getGasCostOfGetPopulatedTicksInWord(poolAddress, getTickTableIndex(0)));
    }).timeout(300_000);

    it('getNextActiveTicks 255 ticks [ @skip-on-coverage ]', async () => {
      const ticks = await tickLens.getNextActiveTicks(poolAddress, getMinTick(1), 255, true);
      expect(ticks.length).to.be.eq(255);

      await snapshotGasCost(tickLens.getGasCostOfGetNextActiveTicks(poolAddress, getMinTick(1), 255, true));
    }).timeout(300_000);

    it('getNextActiveTicks 512 ticks [ @skip-on-coverage ]', async () => {
      const ticks = await tickLens.getNextActiveTicks(poolAddress, getMinTick(1), 512, true);
      expect(ticks.length).to.be.eq(260);

      await snapshotGasCost(tickLens.getGasCostOfGetNextActiveTicks(poolAddress, getMinTick(1), 512, true));
    }).timeout(300_000);
  });
});
