import { ethers } from 'hardhat';
import { Wallet } from 'ethers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { TestERC20 } from '../typechain';
import { algebraFixture, AlgebraFixtureType } from './shared/fixtures';
import {
  expect,
  blockTimestamp,
  BNe18,
  ActorFixture,
} from './shared';
import { provider } from './shared/provider';
import { HelperCommands, ERC20Helper, incentiveResultToFarmAdapter, expectRewardRatio } from './helpers';
import { createTimeMachine } from './shared/time';
import { HelperTypes } from './helpers/types';

describe('Scenario tests', () => {
  let actors: ActorFixture;
  let lpUser0: Wallet;
  let lpUser1: Wallet;
  let lpUser2: Wallet;
  const amountDesired = BNe18(10);
  const totalReward = BNe18(1_000_000_000);
  const bonusReward = BNe18(200_000_000);
  const erc20Helper = new ERC20Helper();
  const Time = createTimeMachine();
  let helpers: HelperCommands;
  let context: AlgebraFixtureType;
  const nonce = 0n;

  before(async () => {
    const wallets = (await ethers.getSigners()) as any as Wallet[];
    actors = new ActorFixture(wallets, provider);
    lpUser0 = actors.lpUser0();
    lpUser1 = actors.lpUser1();
    lpUser2 = actors.lpUser2();
  });

  beforeEach('create fixture loader', async () => {
    context = await loadFixture(algebraFixture);
    helpers = HelperCommands.fromTestContext(context, actors, provider);
  });

  describe('Scenario: Three LPs with different shares in same range', () => {
    let createIncentiveResultEternal: HelperTypes.CreateIncentive.Result;
    let tokensToFarm: [TestERC20, TestERC20];
    let lpUser3: Wallet;
    let lpUser4: Wallet;
    let mint0: HelperTypes.MintDepositFarm.Result;
    let mint1: HelperTypes.MintDepositFarm.Result;
    let mint2: HelperTypes.MintDepositFarm.Result;
    let incentiveKey: any;
    let currentTick: bigint;
    let tickSpacing: bigint;

    beforeEach('Setup incentive and three LPs', async () => {
      lpUser3 = actors.lpUser3();
      lpUser4 = actors.lpUser4();
      tokensToFarm = [context.token0, context.token1] as [TestERC20, TestERC20];

      await Promise.all([
        erc20Helper.ensureBalancesAndApprovals(lpUser0, tokensToFarm, amountDesired, await context.nft.getAddress()),
        erc20Helper.ensureBalancesAndApprovals(lpUser1, tokensToFarm, amountDesired * 2n, await context.nft.getAddress()),
        erc20Helper.ensureBalancesAndApprovals(lpUser2, tokensToFarm, amountDesired * 3n, await context.nft.getAddress()),
        erc20Helper.ensureBalancesAndApprovals(lpUser3, tokensToFarm, amountDesired, await context.nft.getAddress()),
        erc20Helper.ensureBalancesAndApprovals(lpUser4, tokensToFarm, amountDesired, await context.nft.getAddress()),
      ]);

      createIncentiveResultEternal = await helpers.createIncentiveFlow({
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: await context.poolObj.getAddress(),
        nonce,
        minimalPositionWidth: 240,
      });

      incentiveKey = await incentiveResultToFarmAdapter(createIncentiveResultEternal);

      const poolState = await helpers.getPoolState();
      currentTick = poolState.currentTick;
      tickSpacing = poolState.tickSpacing;

      mint0 = await helpers.mintDepositFarmFlow({
        lp: lpUser0, tokensToFarm,
        ticks: [Number(currentTick - 10n * tickSpacing), Number(currentTick + 10n * tickSpacing)],
        amountsToFarm: [amountDesired, amountDesired],
        createIncentiveResult: createIncentiveResultEternal,
      });
      mint1 = await helpers.mintDepositFarmFlow({
        lp: lpUser1, tokensToFarm,
        ticks: [Number(currentTick - 10n * tickSpacing), Number(currentTick + 10n * tickSpacing)],
        amountsToFarm: [amountDesired * 2n, amountDesired * 2n],
        createIncentiveResult: createIncentiveResultEternal,
      });
      mint2 = await helpers.mintDepositFarmFlow({
        lp: lpUser2, tokensToFarm,
        ticks: [Number(currentTick - 10n * tickSpacing), Number(currentTick + 10n * tickSpacing)],
        amountsToFarm: [amountDesired * 3n, amountDesired * 3n],
        createIncentiveResult: createIncentiveResultEternal,
      });

      await helpers.setRates(incentiveKey, BNe18(10), BNe18(2));
    });


    describe('Incentive setup', () => {

      it('cannot use if not nonfungiblePosManager', async () => {
        await expect(
          context.farmingCenter.applyLiquidityDelta(mint0.tokenId, 100)
        ).to.be.revertedWith('Only nonfungiblePosManager');
      });

      it('cannot create two incentives on the same pool simultaneously', async () => {
        await expect(
          helpers.createIncentiveFlow({
            rewardToken: context.rewardToken,
            bonusRewardToken: context.bonusRewardToken,
            totalReward: BNe18(1_000_000),
            bonusReward: BNe18(200_000),
            poolAddress: await context.poolObj.getAddress(),
            nonce: nonce + 1n,
            rewardRate: BNe18(10),
            bonusRewardRate: BNe18(2),
          })
        ).to.be.reverted;
      });

      it('minimalPositionWidth: position narrower than minimum is rejected on enterFarming', async () => {
        const tooNarrow = await helpers.mintFlow({
          lp: lpUser3,
          tokens: tokensToFarm,
          tickLower: Number(currentTick - tickSpacing),
          tickUpper: Number(currentTick + tickSpacing),
        });
        await helpers.depositFlow({ lp: lpUser3, tokenId: tooNarrow.tokenId });
        await expect(
          helpers.farmingCenter.connect(lpUser3).enterFarming(incentiveKey, tooNarrow.tokenId)
        ).to.be.revertedWithCustomError(context.eternalFarming, 'positionIsTooNarrow');
      });

    });


    describe('Reward distribution', () => {

      it('rewards are proportional to liquidity share (1x / 2x / 3x)', async () => {
        await Time.setAndMine(await blockTimestamp() + 10_000);
        await helpers.swapTwice(lpUser0, 5, 0);

        const [r0, r1, r2] = await helpers.getRewardInfoBatch(incentiveKey, [mint0.tokenId, mint1.tokenId, mint2.tokenId]);

        expectRewardRatio(r0.reward, r1.reward, 2n);
        expectRewardRatio(r0.reward, r2.reward, 3n);
        expectRewardRatio(r0.bonusReward, r0.reward, 5n);
        expectRewardRatio(r0.bonusReward, r1.bonusReward, 2n);
        expectRewardRatio(r0.bonusReward, r2.bonusReward, 3n);

        await Time.setAndMine(await blockTimestamp() + 10_000);
        await helpers.swapTwice(lpUser0, 5, 0);

        const [r0b, r1b, r2b] = await helpers.getRewardInfoBatch(incentiveKey, [mint0.tokenId, mint1.tokenId, mint2.tokenId]);

        expectRewardRatio(r0b.reward, r1b.reward, 2n);
        expectRewardRatio(r0b.reward, r2b.reward, 3n);
        expectRewardRatio(r0b.bonusReward, r0b.reward, 5n);
        expectRewardRatio(r0b.bonusReward, r1b.bonusReward, 2n);
        expectRewardRatio(r0b.bonusReward, r2b.bonusReward, 3n);
      });

      it('multiple ranges distribute rewards proportionally; out-of-range earns nothing', async () => {
        const mintWide = await helpers.mintDepositFarmFlow({
          lp: lpUser3, tokensToFarm,
          ticks: [Number(currentTick - 20n * tickSpacing), Number(currentTick + 20n * tickSpacing)],
          amountsToFarm: [amountDesired * 2n, amountDesired * 2n],
          createIncentiveResult: createIncentiveResultEternal,
        });
        const mintOOR = await helpers.mintDepositFarmFlow({
          lp: lpUser4, tokensToFarm,
          ticks: [Number(currentTick + 30n * tickSpacing), Number(currentTick + 40n * tickSpacing)],
          amountsToFarm: [amountDesired, amountDesired], createIncentiveResult: createIncentiveResultEternal,
        });

        await Time.setAndMine(await blockTimestamp() + 10_000);
        await helpers.swapTwice(lpUser0, 5, 0);

        const [r0, r1, r2, r3, r4] = await helpers.getRewardInfoBatch(incentiveKey, [
          mint0.tokenId, mint1.tokenId, mint2.tokenId, mintWide.tokenId, mintOOR.tokenId,
        ]);
        
        expectRewardRatio(r0.reward, r1.reward, 2n);
        expectRewardRatio(r0.reward, r2.reward, 3n);
        expectRewardRatio(r0.reward, r3.reward, 1n, 200n);
        expect(r4.reward).to.equal(0n, 'out-of-range LP should earn no rewards');
        expectRewardRatio(r0.bonusReward, r1.bonusReward, 2n);
        expectRewardRatio(r0.bonusReward, r2.bonusReward, 3n);
        expectRewardRatio(r0.bonusReward, r3.bonusReward, 1n, 200n);
        expect(r4.bonusReward).to.equal(0n, 'out-of-range LP should earn no bonus rewards');
      });

      it('total distributed rewards ≈ rewardRate × elapsed time', async () => {
        const t0 = BigInt(await blockTimestamp());
        const { rewardRate0: rewardRate, rewardRate1: bonusRewardRate } =
          await helpers.getRewardRate({ createIncentiveResult: createIncentiveResultEternal });

        await helpers.swapTwice(lpUser0, 5, 0);
        await Time.setAndMine(Number(t0) + 1000);
        const t1 = BigInt(await blockTimestamp());

        const [r0, r1, r2] = await helpers.getRewardInfoBatch(incentiveKey, [mint0.tokenId, mint1.tokenId, mint2.tokenId]);

        expectRewardRatio((t1 - t0) * rewardRate, r0.reward + r1.reward + r2.reward, 1n);
        expectRewardRatio((t1 - t0) * bonusRewardRate, r0.bonusReward + r1.bonusReward + r2.bonusReward, 1n);
      });

      // it('no rewards accrue without swap activity', async () => {
      //   await Time.setAndMine(await blockTimestamp() + 10_000);

      //   const [r0, r1, r2] = await helpers.getRewardInfoBatch(incentiveKey, [mint0.tokenId, mint1.tokenId, mint2.tokenId]);

      //   expect(r0.reward + r1.reward + r2.reward).to.equal(0n);
      //   expect(r0.bonusReward + r1.bonusReward + r2.bonusReward).to.equal(0n);
      // });

    });


    describe('Rates & caps', () => {

      it('halving rates halves reward accrual for the next period', async () => {
        await Time.setAndMine(await blockTimestamp() + 10_000);
        await helpers.swapTwice(lpUser0, 5, 0);
        const [snap1] = await helpers.getRewardInfoBatch(incentiveKey, [mint0.tokenId]);
        const rewardP1 = snap1.reward;
        const bonusP1 = snap1.bonusReward;

        await helpers.setRates(incentiveKey, BNe18(5), BNe18(1));

        await Time.setAndMine(await blockTimestamp() + 10_000);
        await helpers.swapTwice(lpUser0, 5, 0);
        const [snap2] = await helpers.getRewardInfoBatch(incentiveKey, [mint0.tokenId]);
        const rewardP2 = snap2.reward - rewardP1;
        const bonusP2 = snap2.bonusReward - bonusP1;

        expectRewardRatio(rewardP2, rewardP1, 2n);
        expectRewardRatio(bonusP2, bonusP1, 2n);
      });

      it('rewards stop accruing once totalReward is exhausted', async () => {
        await helpers.setRates(incentiveKey, BNe18(10_000), BNe18(2_000));

        await Time.setAndMine(await blockTimestamp() + 100_000);
        await helpers.swapTwice(lpUser0, 5, 0);

        const cap = createIncentiveResultEternal.totalReward;
        const bonusCap = createIncentiveResultEternal.bonusReward;

        const [r0, r1, r2] = await helpers.getRewardInfoBatch(incentiveKey, [mint0.tokenId, mint1.tokenId, mint2.tokenId]);
        const accrued = r0.reward + r1.reward + r2.reward;
        const accruedBonus = r0.bonusReward + r1.bonusReward + r2.bonusReward;

        expectRewardRatio(accrued, cap, 1n);
        expectRewardRatio(accruedBonus, bonusCap, 1n);

        await Time.setAndMine(await blockTimestamp() + 100_000);
        await helpers.swapTwice(lpUser0, 5, 0);

        const [r0a, r1a, r2a] = await helpers.getRewardInfoBatch(incentiveKey, [mint0.tokenId, mint1.tokenId, mint2.tokenId]);
        const accruedPost = r0a.reward + r1a.reward + r2a.reward;
        const accruedBonusPost = r0a.bonusReward + r1a.bonusReward + r2a.bonusReward;

        expectRewardRatio(accruedPost, cap, 1n);
        expectRewardRatio(accruedBonusPost, bonusCap, 1n);
      });

    });


    describe('LP lifecycle', () => {

      it('late entry: no retroactive rewards for time before entering farming', async () => {
        await Time.setAndMine(await blockTimestamp() + 10_000);
        await helpers.swapTwice(lpUser0, 5, 0);

        const earlySnap = await helpers.getRewardInfo(incentiveKey, mint0.tokenId);
        expect(earlySnap.reward).to.be.gt(0n);

        const lateMint = await helpers.mintDepositFarmFlow({
          lp: lpUser3, tokensToFarm,
          ticks: [Number(currentTick - 10n * tickSpacing), Number(currentTick + 10n * tickSpacing)],
          amountsToFarm: [amountDesired, amountDesired],
          createIncentiveResult: createIncentiveResultEternal,
        });

        const riAtEntry = await helpers.getRewardInfo(incentiveKey, lateMint.tokenId);
        expect(riAtEntry.reward).to.equal(0n, 'late LP should have no rewards at entry');
        expect(riAtEntry.bonusReward).to.equal(0n, 'late LP should have no bonus at entry');

        await Time.setAndMine(await blockTimestamp() + 10_000);
        await helpers.swapTwice(lpUser0, 5, 0);

        const [lateSnap, earlySnap2] = await helpers.getRewardInfoBatch(incentiveKey, [lateMint.tokenId, mint0.tokenId]);

        expect(lateSnap.reward).to.be.gt(0n, 'late LP should earn after entering');
        expect(lateSnap.bonusReward).to.be.gt(0n, 'late LP should earn bonus after entering');
        expect(earlySnap2.reward).to.be.gt(lateSnap.reward, 'early LP should have more total rewards');
        expect(earlySnap2.bonusReward).to.be.gt(lateSnap.bonusReward, 'early LP should have more bonus');
      });

      it('new LP joining reduces reward rate for existing LPs', async () => {
        await Time.setAndMine(await blockTimestamp() + 10_000);
        await helpers.swapTwice(lpUser0, 5, 0);

        const [p1r0, p1r1] = await helpers.getRewardInfoBatch(incentiveKey, [mint0.tokenId, mint1.tokenId]);

        await helpers.mintDepositFarmFlow({
          lp: lpUser3, tokensToFarm,
          ticks: [Number(currentTick - 10n * tickSpacing), Number(currentTick + 10n * tickSpacing)],
          amountsToFarm: [amountDesired, amountDesired],
          createIncentiveResult: createIncentiveResultEternal,
        });

        await Time.setAndMine(await blockTimestamp() + 10_000);
        await helpers.swapTwice(lpUser0, 5, 0);

        const [p2r0, p2r1] = await helpers.getRewardInfoBatch(incentiveKey, [mint0.tokenId, mint1.tokenId]);

        expect(p2r0.reward - p1r0.reward).to.be.lt(p1r0.reward);
        expect(p2r0.bonusReward - p1r0.bonusReward).to.be.lt(p1r0.bonusReward);
        expect(p2r1.reward - p1r1.reward).to.be.lt(p1r1.reward);
        expect(p2r1.bonusReward - p1r1.bonusReward).to.be.lt(p1r1.bonusReward);
      });

      it('LP exit increases reward rate for remaining farmers', async () => {
        await Time.setAndMine(await blockTimestamp() + 10_000);
        await helpers.swapTwice(lpUser0, 5, 0);

        const p1r1 = await helpers.getRewardInfo(incentiveKey, mint1.tokenId);

        await helpers.exitFarming(incentiveKey, mint0.tokenId, lpUser0);

        await Time.setAndMine(await blockTimestamp() + 10_000);
        await helpers.swapTwice(lpUser0, 5, 0);

        const p2r1 = await helpers.getRewardInfo(incentiveKey, mint1.tokenId);

        expect(p2r1.reward - p1r1.reward).to.be.gt(p1r1.reward);
        expect(p2r1.bonusReward - p1r1.bonusReward).to.be.gt(p1r1.bonusReward);
      });

      it('LP exits and re-enters: normalized rewards remain proportional', async () => {
        await Time.setAndMine(await blockTimestamp() + 10_000);
        await helpers.swapTwice(lpUser0, 5, 0);

        const { rewardRate0: rewardRate, rewardRate1: bonusRewardRate } =
          await helpers.getRewardRate({ createIncentiveResult: createIncentiveResultEternal });

        const exitAt = await helpers.exitFarming(incentiveKey, mint0.tokenId, lpUser0);
        await Time.setAndMine(await blockTimestamp() + 10_000);
        await helpers.swapTwice(lpUser0, 5, 0);
        const reEntryAt = await helpers.enterFarming(incentiveKey, mint0.tokenId, lpUser0);

        await Time.setAndMine(await blockTimestamp() + 10_000);
        await helpers.swapTwice(lpUser0, 5, 0);

        const collectedRewards = await context.eternalFarming.rewards(lpUser0.address, context.rewardToken);
        const collectedBonus = await context.eternalFarming.rewards(lpUser0.address, context.bonusRewardToken);
        const [r0, r1, r2] = await helpers.getRewardInfoBatch(incentiveKey, [mint0.tokenId, mint1.tokenId, mint2.tokenId]);

        const user0Reward = r0.reward + collectedRewards;
        const user0Bonus = r0.bonusReward + collectedBonus;

        const absentDuration = BigInt(reEntryAt - exitAt);
        const n1 = r1.reward - absentDuration * rewardRate * 2n / 5n;
        const n2 = r2.reward - absentDuration * rewardRate * 3n / 5n;
        const n1Bonus = r1.bonusReward - absentDuration * bonusRewardRate * 2n / 5n;
        const n2Bonus = r2.bonusReward - absentDuration * bonusRewardRate * 3n / 5n;

        expectRewardRatio(user0Reward, n1, 2n);
        expectRewardRatio(user0Reward, n2, 3n);
        expectRewardRatio(user0Bonus, n1Bonus, 2n);
        expectRewardRatio(user0Bonus, n2Bonus, 3n);
      });

      it('phantom liquidity', async () => {
        await Time.setAndMine(await blockTimestamp() + 10_000);
        await helpers.swapTwice(lpUser0, 5, 0);

        const [before0, before1, before2] = await helpers.getRewardInfoBatch(incentiveKey, [mint0.tokenId, mint1.tokenId, mint2.tokenId]);

        await helpers.exitFarming(incentiveKey, mint0.tokenId, lpUser0);
        await helpers.swapTwice(lpUser0, 5, 0);
        await helpers.enterFarming(incentiveKey, mint0.tokenId, lpUser0);

        await Time.setAndMine(await blockTimestamp() + 10_000);
        await helpers.swapTwice(lpUser0, 5, 0);

        const [after0, after1, after2] = await helpers.getRewardInfoBatch(incentiveKey, [mint0.tokenId, mint1.tokenId, mint2.tokenId]);

        expect(after1.reward).to.be.gt(before1.reward, 'User1 should earn more because User0 was out');
        expect(after2.reward).to.be.gt(before2.reward, 'User2 should earn more because User0 was out');
        expectRewardRatio(before0.reward, after0.reward, 1n);
        expectRewardRatio(before1.reward, after1.reward, 2n);
        expectRewardRatio(before2.reward, after2.reward, 2n);
      });

    });


    describe('Liquidity changes', () => {

      it.only('User doubles liquidity - rewards increase accordingly', async () => {
        await helpers.setRates(incentiveKey, BNe18(10), BNe18(2));

        await Time.setAndMine(await blockTimestamp() + 10_000);
        await helpers.swapTwice(lpUser0, 5, 0);

        const snap1 = await helpers.getRewardInfo(incentiveKey, mint0.tokenId);
        const rewardsP1 = snap1.reward;
        const bonusP1 = snap1.bonusReward;
        
        await helpers.increaseLiquidity(mint0.tokenId, amountDesired, amountDesired, lpUser0);

        await Time.setAndMine(await blockTimestamp() + 10_000);
        await helpers.swapTwice(lpUser0, 5, 0);

        const snap2 = await helpers.getRewardInfo(incentiveKey, mint0.tokenId);
        const rewardsP2 = snap2.reward;
        const bonusP2 = snap2.bonusReward;

        const rewardsP1Scaled = rewardsP1 * 6n;
        const rewardsP2Scaled = rewardsP2 * 7n / 2n;
        const bonusP1Scaled = bonusP1 * 6n;
        const bonusP2Scaled = bonusP2 * 7n / 2n;

        expectRewardRatio(rewardsP1Scaled, rewardsP2Scaled, 1n);
        expectRewardRatio(bonusP1Scaled, bonusP2Scaled, 1n);
      });

      it('User halves liquidity - rewards decrease accordingly', async () => {
        await helpers.setRates(incentiveKey, BNe18(10), BNe18(2));

        await Time.setAndMine(await blockTimestamp() + 10_000);
        await helpers.swapTwice(lpUser0, 5, 0);

        const snap1 = await helpers.getRewardInfo(incentiveKey, mint1.tokenId);
        const rewardsP1 = snap1.reward;
        const bonusP1 = snap1.bonusReward;
        
        const liq = await helpers.getPositionLiquidity(mint1.tokenId, lpUser1);
        await helpers.decreaseLiquidity(mint1.tokenId, liq/2n, lpUser1);

        await Time.setAndMine(await blockTimestamp() + 10_000);
        await helpers.swapTwice(lpUser0, 5, 0);

        const snap2 = await helpers.getRewardInfo(incentiveKey, mint1.tokenId);
        const rewardsP2 = snap2.reward;
        const bonusP2 = snap2.bonusReward;

        const rewardsP1Scaled = rewardsP1 * 3n;
        const rewardsP2Scaled = rewardsP2 * 5n;
        const bonusP1Scaled = bonusP1 * 3n;
        const bonusP2Scaled = bonusP2 * 5n;


        expectRewardRatio(rewardsP1Scaled, rewardsP2Scaled, 1n);
        expectRewardRatio(bonusP1Scaled, bonusP2Scaled, 1n);
      });

    });

  });

});
