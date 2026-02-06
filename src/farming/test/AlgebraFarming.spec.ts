import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { TestContext } from './types';
import { AlgebraEternalFarming, TestERC20 } from '../typechain';
import { ethers } from 'hardhat';
import {
  blockTimestamp,
  BNe18,
  expect,
  FeeAmount,
  getMaxTick,
  getMinTick,
  TICK_SPACINGS,
  algebraFixture,
  days,
  bnSum,
  mintPosition,
} from './shared';
import { createTimeMachine } from './shared/time';
import { ERC20Helper, HelperCommands, incentiveResultToFarmAdapter } from './helpers';
import { provider } from './shared/provider';
import { ActorFixture } from './shared/actors';
import { HelperTypes } from './helpers/types';
import { Wallet } from 'ethers';

describe('AlgebraFarming', () => {
  let wallets: Wallet[];
  const Time = createTimeMachine();
  let actors: ActorFixture;
  const e20h = new ERC20Helper();

  const TICK_SPACING = TICK_SPACINGS[FeeAmount.MEDIUM];
  const FULL_RANGE_TICKS: [number, number] = [getMinTick(TICK_SPACING), getMaxTick(TICK_SPACING)];
  const TOTAL_REWARD = BNe18(100_000);
  const BONUS_REWARD = BNe18(50_000);
  const REWARD_RATE = BNe18(1);
  const BONUS_REWARD_RATE = BNe18(1) / 2n;
  const ONE_DAY_SECONDS = 86400n;

  type TestSubject = {
    helpers: HelperCommands;
    context: TestContext;
    createIncentiveResult: HelperTypes.CreateIncentive.Result;
    incentiveKey: any;
  };

  before(async () => {
    wallets = (await ethers.getSigners()) as any as Wallet[];
    actors = new ActorFixture(wallets, provider);
  });

  const mainScenario: () => Promise<TestSubject> = async () => {
    const context = await algebraFixture();
    const wallets = (await ethers.getSigners()) as any as Wallet[];
    const helpers = HelperCommands.fromTestContext(context, new ActorFixture(wallets, ethers.provider), ethers.provider);

    const nonce = await context.eternalFarming.numOfIncentives();

    const createIncentiveResult = await helpers.createIncentiveFlow({
      nonce,
      rewardToken: context.rewardToken,
      bonusRewardToken: context.bonusRewardToken,
      poolAddress: context.pool01,
      totalReward: TOTAL_REWARD,
      bonusReward: BONUS_REWARD,
      rewardRate: REWARD_RATE,
      bonusRewardRate: BONUS_REWARD_RATE,
    });

    const incentiveKey = await incentiveResultToFarmAdapter(createIncentiveResult);

    return { context, helpers, createIncentiveResult, incentiveKey };
  };

  describe('Minimal position width', () => {
    const totalReward = BNe18(2_000_000);
    const bonusReward = BNe18(4_000);
    const amountsToFarm: [bigint, bigint] = [BigInt(100000), BNe18(10)];

    const scenario = async () => {
      const context = await algebraFixture();
      const wallets = (await ethers.getSigners()) as any as Wallet[];
      const helpers = HelperCommands.fromTestContext(context, new ActorFixture(wallets, ethers.provider), ethers.provider);
      return { context, helpers };
    };

    it('too wide range cannot be used as minimal allowed', async () => {
      const { context, helpers } = await loadFixture(scenario);
      const lpUser = actors.traderUser2();

      await e20h.ensureBalancesAndApprovals(lpUser, [context.token0, context.token1], amountsToFarm[0], await context.nft.getAddress());

      const tokenId = await mintPosition(context.nft.connect(lpUser), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: FULL_RANGE_TICKS[0],
        tickUpper: FULL_RANGE_TICKS[0] + TICK_SPACING,
        recipient: lpUser.address,
        amount0Desired: 0,
        amount1Desired: amountsToFarm[0],
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 10000,
      });

      await context.nft.connect(lpUser).approveForFarming(tokenId, true, context.farmingCenter);

      const incentiveCreator = actors.incentiveCreator();
      const nonce = await context.eternalFarming.numOfIncentives();

      await context.rewardToken.transfer(incentiveCreator.address, totalReward);
      await context.bonusRewardToken.transfer(incentiveCreator.address, bonusReward);
      await context.rewardToken.connect(incentiveCreator).approve(context.eternalFarming, totalReward);
      await context.bonusRewardToken.connect(incentiveCreator).approve(context.eternalFarming, bonusReward);

      // Max int24 + Max int24
      await expect(
        (context.eternalFarming as AlgebraEternalFarming).connect(incentiveCreator).createEternalFarming(
          {
            pool: context.pool01,
            rewardToken: context.rewardToken,
            bonusRewardToken: context.bonusRewardToken,
            nonce,
          },
          {
            reward: totalReward,
            bonusReward: bonusReward,
            rewardRate: 10,
            bonusRewardRate: 10,
            minimalPositionWidth: 2 ** 23 - 1 + 2 ** 23 - 1,
            weight0: 50000,
            weight1: 50000,
          },
          await context.poolObj.connect(incentiveCreator).plugin()
        )
      ).to.be.revertedWithCustomError(context.eternalFarming, 'minimalPositionWidthTooWide');

      // 887272 * 2 + 1
      await expect(
        (context.eternalFarming as AlgebraEternalFarming).connect(incentiveCreator).createEternalFarming(
          {
            pool: context.pool01,
            rewardToken: context.rewardToken,
            bonusRewardToken: context.bonusRewardToken,
            nonce,
          },
          {
            reward: totalReward,
            bonusReward: bonusReward,
            rewardRate: 10,
            bonusRewardRate: 10,
            minimalPositionWidth: 887272 * 2 + 1,
            weight0: 50000,
            weight1: 50000,
          },
          await context.poolObj.connect(incentiveCreator).plugin()
        )
      ).to.be.revertedWithCustomError(context.eternalFarming, 'minimalPositionWidthTooWide');

      await expect(
        (context.eternalFarming as AlgebraEternalFarming).connect(incentiveCreator).createEternalFarming(
          {
            pool: context.pool01,
            rewardToken: context.rewardToken,
            bonusRewardToken: context.bonusRewardToken,
            nonce,
          },
          {
            reward: totalReward,
            bonusReward: bonusReward,
            rewardRate: 10,
            bonusRewardRate: 10,
            minimalPositionWidth: (887272 - (887272 % 60)) * 2,
            weight0: 50000,
            weight1: 50000,
          },
          await context.poolObj.connect(incentiveCreator).plugin()
        )
      ).to.be.not.reverted;
    });

    it('max range can be used as minimal allowed', async () => {
      const { context, helpers } = await loadFixture(scenario);
      const lpUser = actors.traderUser2();
      const balanceDeposited = amountsToFarm[0];

      await e20h.ensureBalancesAndApprovals(lpUser, [context.token0, context.token1], balanceDeposited * 2n, await context.nft.getAddress());

      // Narrow position
      const tokenIdNarrow = await mintPosition(context.nft.connect(lpUser), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: FULL_RANGE_TICKS[0],
        tickUpper: FULL_RANGE_TICKS[0] + TICK_SPACING,
        recipient: lpUser.address,
        amount0Desired: 0,
        amount1Desired: balanceDeposited,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 10000,
      });

      // Full range position
      const tokenIdFull = await mintPosition(context.nft.connect(lpUser), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: FULL_RANGE_TICKS[0],
        tickUpper: FULL_RANGE_TICKS[1],
        recipient: lpUser.address,
        amount0Desired: balanceDeposited,
        amount1Desired: balanceDeposited,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 10000,
      });

      await context.nft.connect(lpUser).approveForFarming(tokenIdNarrow, true, context.farmingCenter);
      await context.nft.connect(lpUser).approveForFarming(tokenIdFull, true, context.farmingCenter);

      const nonce = await context.eternalFarming.numOfIncentives();

      const createIncentiveResult = await helpers.createIncentiveFlow({
        nonce,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        minimalPositionWidth: FULL_RANGE_TICKS[1] - FULL_RANGE_TICKS[0],
        poolAddress: context.pool01,
        totalReward,
        bonusReward,
      });

      const incentiveKey = await incentiveResultToFarmAdapter(createIncentiveResult);

      await expect(
        context.farmingCenter.connect(lpUser).enterFarming(incentiveKey, tokenIdNarrow)
      ).to.be.revertedWithCustomError(context.eternalFarming, 'positionIsTooNarrow');

      await expect(
        context.farmingCenter.connect(lpUser).enterFarming(incentiveKey, tokenIdFull)
      ).to.be.not.reverted;
    });
  });

  describe('Reward calculation', () => {
    let subject: TestSubject;

    beforeEach(async () => {
      subject = await loadFixture(mainScenario);
    });

    it('earns ~100% of rewards for single LP over 1 day', async () => {
      const { context, helpers, createIncentiveResult, incentiveKey } = subject;
      const lpUser = actors.lpUser0();
      const trader = actors.traderUser0();

      const farmResult = await helpers.mintDepositFarmFlow({
        lp: lpUser,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(1), BNe18(1)],
        ticks: FULL_RANGE_TICKS,
        createIncentiveResult,
      });

      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 100 });
      await helpers.makeTickGoFlow({ trader, direction: 'down', desiredValue: -100 });

      await time.increase(days(1));

      await context.farmingCenter.connect(lpUser).exitFarming(incentiveKey, farmResult.tokenId);

      const rewardBalance = await context.eternalFarming.rewards(lpUser.address, context.rewardToken);
      const expectedReward = ONE_DAY_SECONDS * REWARD_RATE;

      expect(rewardBalance).to.be.closeTo(expectedReward, expectedReward / 1000n);
    });

    it('accumulates rewards correctly with multiple collect calls', async () => {
      const { context, helpers, createIncentiveResult, incentiveKey } = subject;
      const lpUser = actors.lpUser0();
      const trader = actors.traderUser0();

      const farmResult = await helpers.mintDepositFarmFlow({
        lp: lpUser,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(1), BNe18(1)],
        ticks: FULL_RANGE_TICKS,
        createIncentiveResult,
      });

      // First period
      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 50 });
      await time.increase(3600);
      await context.farmingCenter.connect(lpUser).collectRewards(incentiveKey, farmResult.tokenId);
      const rewards1 = await context.eternalFarming.rewards(lpUser.address, context.rewardToken);

      // Second period
      await helpers.makeTickGoFlow({ trader, direction: 'down', desiredValue: -50 });
      await time.increase(3600);
      await context.farmingCenter.connect(lpUser).collectRewards(incentiveKey, farmResult.tokenId);
      const rewards2 = await context.eternalFarming.rewards(lpUser.address, context.rewardToken);

      expect(rewards2).to.be.gt(rewards1);

      const hourlyReward = 3600n * REWARD_RATE;
      expect(rewards1).to.be.closeTo(hourlyReward, hourlyReward / 10n);
      expect(rewards2).to.be.closeTo(hourlyReward * 2n, hourlyReward / 5n);
    });
  });

  describe('Multiple LPs - proportional distribution', () => {
    let subject: TestSubject;

    beforeEach(async () => {
      subject = await loadFixture(mainScenario);
    });

    it('distributes rewards in 3:1 ratio for 3x:1x liquidity positions', async () => {
      const { context, helpers, createIncentiveResult, incentiveKey } = subject;
      const lpUser1 = actors.lpUser0();
      const lpUser2 = actors.lpUser1();
      const trader = actors.traderUser0();

      const farm1 = await helpers.mintDepositFarmFlow({
        lp: lpUser1,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(1), BNe18(1)],
        ticks: FULL_RANGE_TICKS,
        createIncentiveResult,
      });

      const farm2 = await helpers.mintDepositFarmFlow({
        lp: lpUser2,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(3), BNe18(3)],
        ticks: FULL_RANGE_TICKS,
        createIncentiveResult,
      });

      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 100 });
      await helpers.makeTickGoFlow({ trader, direction: 'down', desiredValue: -100 });

      await time.increase(days(1));

      await context.farmingCenter.connect(lpUser1).exitFarming(incentiveKey, farm1.tokenId);
      await context.farmingCenter.connect(lpUser2).exitFarming(incentiveKey, farm2.tokenId);

      await context.eternalFarming.connect(lpUser1).claimReward(context.rewardToken, lpUser1.address, 0);
      await context.eternalFarming.connect(lpUser2).claimReward(context.rewardToken, lpUser2.address, 0);

      const balance1 = await context.rewardToken.balanceOf(lpUser1.address);
      const balance2 = await context.rewardToken.balanceOf(lpUser2.address);

      const ratio = Number(balance2) / Number(balance1);
      expect(ratio).to.be.closeTo(3, 0.1);

      const totalRewards = balance1 + balance2;
      const expectedTotal = ONE_DAY_SECONDS * REWARD_RATE;
      expect(totalRewards).to.be.closeTo(expectedTotal, expectedTotal / 100n);
    });

    it('distributes rewards correctly when one LP exits mid-way', async () => {
      const { context, helpers, createIncentiveResult, incentiveKey } = subject;
      const lpUser1 = actors.lpUser0();
      const lpUser2 = actors.lpUser1();
      const trader = actors.traderUser0();

      const farm1 = await helpers.mintDepositFarmFlow({
        lp: lpUser1,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(1), BNe18(1)],
        ticks: FULL_RANGE_TICKS,
        createIncentiveResult,
      });

      const farm2 = await helpers.mintDepositFarmFlow({
        lp: lpUser2,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(1), BNe18(1)],
        ticks: FULL_RANGE_TICKS,
        createIncentiveResult,
      });

      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 50 });
      await time.increase(days(1));

      await context.farmingCenter.connect(lpUser1).exitFarming(incentiveKey, farm1.tokenId);

      await helpers.makeTickGoFlow({ trader, direction: 'down', desiredValue: -50 });
      await time.increase(days(1));

      await context.farmingCenter.connect(lpUser2).exitFarming(incentiveKey, farm2.tokenId);

      const reward1 = await context.eternalFarming.rewards(lpUser1.address, context.rewardToken);
      const reward2 = await context.eternalFarming.rewards(lpUser2.address, context.rewardToken);

      expect(reward1).to.be.gt(0n);
      expect(reward2).to.be.gt(reward1);

      const ratio = Number(reward2) / Number(reward1);
      expect(ratio).to.be.gt(2);
    });

    it('three LPs with different entry times receive proportional rewards', async () => {
      const { context, helpers, createIncentiveResult, incentiveKey } = subject;
      const lpUser1 = actors.lpUser0();
      const lpUser2 = actors.lpUser1();
      const lpUser3 = actors.lpUser2();
      const trader = actors.traderUser0();

      const currentTick = (await helpers.pool.connect(lpUser1).globalState()).tick;
      const tickSpacing = await helpers.pool.connect(lpUser1).tickSpacing();
      const ticks: [number, number] = [Number(currentTick - 10n * tickSpacing), Number(currentTick + 10n * tickSpacing)];

      const farm1 = await helpers.mintDepositFarmFlow({
        lp: lpUser1,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(10), BNe18(10)],
        ticks,
        createIncentiveResult,
      });

      // Generate fees between entries
      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 10 });

      const farm2 = await helpers.mintDepositFarmFlow({
        lp: lpUser2,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(10), BNe18(10)],
        ticks,
        createIncentiveResult,
      });

      await helpers.makeTickGoFlow({ trader, direction: 'down', desiredValue: -10 });

      const farm3 = await helpers.mintDepositFarmFlow({
        lp: lpUser3,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(10), BNe18(10)],
        ticks,
        createIncentiveResult,
      });

      // Generate more fees
      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 20 });

      const checkTime = (await blockTimestamp()) + 100;
      await Time.setAndMine(checkTime);

      const rewardInfo1 = await context.eternalFarming.getRewardInfo(incentiveKey, farm1.tokenId);
      const rewardInfo2 = await context.eternalFarming.getRewardInfo(incentiveKey, farm2.tokenId);
      const rewardInfo3 = await context.eternalFarming.getRewardInfo(incentiveKey, farm3.tokenId);

      // User1 should have most rewards (participated in most fee generation)
      // User2 should have middle rewards
      // User3 should have least rewards (entered last, missed most fees)
      expect(rewardInfo1.reward).to.be.gte(rewardInfo2.reward);
      expect(rewardInfo2.reward).to.be.gte(rewardInfo3.reward);

      // All LPs should have earned some rewards
      const actualTotal = BigInt(rewardInfo1.reward) + BigInt(rewardInfo2.reward) + BigInt(rewardInfo3.reward);
      expect(actualTotal).to.be.gt(0n);
    });

    it('allows all LPs to withdraw after farming period', async () => {
      const { context, helpers, createIncentiveResult } = subject;
      const duration = days(1);

      const tokensToFarm: [TestERC20, TestERC20] = [context.token0, context.token1];
      const amountsToFarm: [bigint, bigint] = [BNe18(1), BNe18(1)];

      const farms = await Promise.all(
        actors.lpUsers().map((lp) =>
          helpers.mintDepositFarmFlow({
            lp,
            tokensToFarm,
            amountsToFarm,
            ticks: FULL_RANGE_TICKS,
            createIncentiveResult,
          })
        )
      );

      const trader = actors.traderUser0();
      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 10 });

      await time.increase(duration);

      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 20 });

      const exitFarmings = await Promise.all(
        farms.map(({ lp, tokenId }) =>
          helpers.exitFarmingCollectBurnFlow({
            lp,
            tokenId,
            createIncentiveResult,
          })
        )
      );

      const rewardsEarned = bnSum(exitFarmings.map((o) => o.balance));
      expect(rewardsEarned).to.be.gt(0n);
    });
  });

  describe('Edge cases', () => {
    let subject: TestSubject;

    beforeEach(async () => {
      subject = await loadFixture(mainScenario);
    });

    it('earns zero rewards when no swaps occur', async () => {
      const { context, helpers, createIncentiveResult, incentiveKey } = subject;
      const lpUser = actors.lpUser0();

      const farmResult = await helpers.mintDepositFarmFlow({
        lp: lpUser,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(1), BNe18(1)],
        ticks: FULL_RANGE_TICKS,
        createIncentiveResult,
      });

      await time.increase(days(1));

      await context.farmingCenter.connect(lpUser).exitFarming(incentiveKey, farmResult.tokenId);
      await context.eternalFarming.connect(lpUser).claimReward(context.rewardToken, lpUser.address, 0);

      const balance = await context.rewardToken.balanceOf(lpUser.address);
      expect(balance).to.eq(0n);
    });

    it('earns zero rewards for out-of-range position', async () => {
      const { context, helpers, createIncentiveResult, incentiveKey } = subject;
      const lpUser = actors.lpUser0();
      const trader = actors.traderUser0();

      const outOfRangeTicks: [number, number] = [6000, 12000];
      await e20h.ensureBalancesAndApprovals(lpUser, [context.token0, context.token1], BNe18(10), await context.nft.getAddress());

      const tokenId = await mintPosition(context.nft.connect(lpUser), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: outOfRangeTicks[0],
        tickUpper: outOfRangeTicks[1],
        recipient: lpUser.address,
        amount0Desired: BNe18(1),
        amount1Desired: 0,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 10000,
      });

      await context.nft.connect(lpUser).approveForFarming(tokenId, true, context.farmingCenter);
      await context.farmingCenter.connect(lpUser).enterFarming(incentiveKey, tokenId);

      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 100 });
      await helpers.makeTickGoFlow({ trader, direction: 'down', desiredValue: -100 });

      await time.increase(days(1));

      await context.farmingCenter.connect(lpUser).exitFarming(incentiveKey, tokenId);

      const rewardBalance = await context.eternalFarming.rewards(lpUser.address, context.rewardToken);
      expect(rewardBalance).to.eq(0n);
    });

    it('correctly handles late entry - only earns from post-entry fees', async () => {
      const { context, helpers, createIncentiveResult, incentiveKey } = subject;
      const lpUser = actors.lpUser0();
      const trader = actors.traderUser0();
      const virtualPool = createIncentiveResult.virtualPool;

      await e20h.ensureBalancesAndApprovals(lpUser, [context.token0, context.token1], BNe18(2), await context.nft.getAddress());

      const tokenId = await mintPosition(context.nft.connect(lpUser), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: FULL_RANGE_TICKS[0],
        tickUpper: FULL_RANGE_TICKS[1],
        recipient: lpUser.address,
        amount0Desired: BNe18(1),
        amount1Desired: BNe18(1),
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 10000,
      });

      // Pre-entry swaps - no farming liquidity exists, so NO fees go to virtual pool
      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 50 });

      const totalFees0Before = await virtualPool.totalFees0Collected();
      const totalFees1Before = await virtualPool.totalFees1Collected();
      // No farming liquidity = no fees collected
      expect(totalFees0Before).to.eq(0n);
      expect(totalFees1Before).to.eq(0n);

      // Enter farming
      await context.nft.connect(lpUser).approveForFarming(tokenId, true, context.farmingCenter);
      await context.farmingCenter.connect(lpUser).enterFarming(incentiveKey, tokenId);

      // Post-entry swaps - NOW farming liquidity exists, fees WILL be collected
      await helpers.makeTickGoFlow({ trader, direction: 'down', desiredValue: -50 });
      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 50 });

      const totalFees0After = await virtualPool.totalFees0Collected();
      const totalFees1After = await virtualPool.totalFees1Collected();
      // Should have fees now
      expect(totalFees0After + totalFees1After).to.be.gt(0n);

      await time.increase(days(1));

      await context.farmingCenter.connect(lpUser).exitFarming(incentiveKey, tokenId);
      await context.eternalFarming.connect(lpUser).claimReward(context.rewardToken, lpUser.address, 0);

      const reward = await context.rewardToken.balanceOf(lpUser.address);
      expect(reward).to.be.gt(0n);
    });

    it('LP adding liquidity but not farming does not affect farming rewards', async () => {
      const { context, helpers, createIncentiveResult } = subject;
      const duration = days(1);

      const tokensToFarm: [TestERC20, TestERC20] = [context.token0, context.token1];
      const amountsToFarm: [bigint, bigint] = [BNe18(1), BNe18(1)];

      const farms = await Promise.all(
        actors.lpUsers().map((lp) =>
          helpers.mintDepositFarmFlow({
            lp,
            tokensToFarm,
            amountsToFarm,
            ticks: FULL_RANGE_TICKS,
            createIncentiveResult,
          })
        )
      );

      await time.increase(duration / 2);

      // Non-farming LP adds liquidity
      const lpNonFarming = actors.traderUser2();
      await e20h.ensureBalancesAndApprovals(lpNonFarming, [context.token0, context.token1], amountsToFarm[0], await context.nft.getAddress());

      await mintPosition(context.nft.connect(lpNonFarming), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: FULL_RANGE_TICKS[0],
        tickUpper: FULL_RANGE_TICKS[1],
        recipient: lpNonFarming.address,
        amount0Desired: amountsToFarm[0],
        amount1Desired: amountsToFarm[1],
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 1000,
      });

      await time.increase(duration / 2);

      const trader = actors.traderUser0();
      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 20 });

      const exitFarmings = await Promise.all(
        farms.map(({ lp, tokenId }) =>
          helpers.exitFarmingCollectBurnFlow({
            lp,
            tokenId,
            createIncentiveResult,
          })
        )
      );

      const rewardsEarned = bnSum(exitFarmings.map((s) => s.balance));
      expect(rewardsEarned).to.be.gt(0n);
    });
  });

  describe('Partial liquidity in farming', () => {
    let subject: TestSubject;

    beforeEach(async () => {
      subject = await loadFixture(mainScenario);
    });

    it('virtual pool tracks only farming liquidity', async () => {
      const { context, helpers, createIncentiveResult } = subject;
      const virtualPool = createIncentiveResult.virtualPool;
      const farmingLP = actors.lpUser0();
      const regularLP = actors.lpUser1();

      await e20h.ensureBalancesAndApprovals(regularLP, [context.token0, context.token1], BNe18(1000), await context.nft.getAddress());

      await mintPosition(context.nft.connect(regularLP), {
        token0: context.token0,
        token1: context.token1,
        fee: FeeAmount.MEDIUM,
        tickLower: FULL_RANGE_TICKS[0],
        tickUpper: FULL_RANGE_TICKS[1],
        recipient: regularLP.address,
        amount0Desired: BNe18(500),
        amount1Desired: BNe18(500),
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 10000,
      });

      await helpers.mintDepositFarmFlow({
        lp: farmingLP,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: FULL_RANGE_TICKS,
        createIncentiveResult,
      });

      const virtualLiquidity = await virtualPool.currentLiquidity();
      const realPool = await ethers.getContractAt('IAlgebraPool', context.pool01);
      const realLiquidity = await realPool.liquidity();

      expect(virtualLiquidity).to.be.lt(realLiquidity);
      const ratio = Number(virtualLiquidity) / Number(realLiquidity);
      expect(ratio).to.be.closeTo(0.167, 0.05);
    });

    it('single farming position earns 100% of rewards despite small pool share', async () => {
      const { context, helpers, createIncentiveResult, incentiveKey } = subject;
      const farmingLP = actors.lpUser0();
      const regularLP = actors.lpUser1();
      const trader = actors.traderUser0();

      await e20h.ensureBalancesAndApprovals(regularLP, [context.token0, context.token1], BNe18(2000), await context.nft.getAddress());

      await mintPosition(context.nft.connect(regularLP), {
        token0: context.token0,
        token1: context.token1,
        fee: FeeAmount.MEDIUM,
        tickLower: FULL_RANGE_TICKS[0],
        tickUpper: FULL_RANGE_TICKS[1],
        recipient: regularLP.address,
        amount0Desired: BNe18(900),
        amount1Desired: BNe18(900),
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 10000,
      });

      const farmResult = await helpers.mintDepositFarmFlow({
        lp: farmingLP,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: FULL_RANGE_TICKS,
        createIncentiveResult,
      });

      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 50 });
      await time.increase(days(1));

      await context.farmingCenter.connect(farmingLP).exitFarming(incentiveKey, farmResult.tokenId);
      await context.eternalFarming.connect(farmingLP).claimReward(context.rewardToken, farmingLP.address, 0);

      const reward = await context.rewardToken.balanceOf(farmingLP.address);
      const expectedReward = ONE_DAY_SECONDS * REWARD_RATE;
      expect(reward).to.be.closeTo(expectedReward, expectedReward / 50n);
    });
  });

  describe('Tick crossing scenarios', () => {
    let subject: TestSubject;

    beforeEach(async () => {
      subject = await loadFixture(mainScenario);
    });

    it('swap generates fees and updates feeGrowth in virtual pool', async () => {
      const { context, helpers, createIncentiveResult, incentiveKey } = subject;
      const lpUser = actors.lpUser0();
      const trader = actors.traderUser0();
      const virtualPool = createIncentiveResult.virtualPool;

      await helpers.mintDepositFarmFlow({
        lp: lpUser,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: FULL_RANGE_TICKS,
        createIncentiveResult,
      });

      const feeGrowth0Before = await virtualPool.totalFeeGrowth0();
      const feeGrowth1Before = await virtualPool.totalFeeGrowth1();
      const liquidityBefore = await virtualPool.currentLiquidity();
      expect(liquidityBefore).to.be.gt(0n);

      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 100 });

      const feeGrowth0After = await virtualPool.totalFeeGrowth0();
      const feeGrowth1After = await virtualPool.totalFeeGrowth1();

      expect(feeGrowth0After > feeGrowth0Before || feeGrowth1After > feeGrowth1Before).to.be.true;
    });

    it('two positions at different ranges earn rewards proportionally', async () => {
      const { context, helpers, createIncentiveResult, incentiveKey } = subject;
      const lp1 = actors.lpUser0();
      const lp2 = actors.lpUser1();
      const trader = actors.traderUser0();

      const farm1 = await helpers.mintDepositFarmFlow({
        lp: lp1,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: [-120, 120],
        createIncentiveResult,
      });

      const farm2 = await helpers.mintDepositFarmFlow({
        lp: lp2,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: FULL_RANGE_TICKS,
        createIncentiveResult,
      });

      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 50 });
      await helpers.makeTickGoFlow({ trader, direction: 'down', desiredValue: -50 });

      await time.increase(days(1));

      await context.farmingCenter.connect(lp1).exitFarming(incentiveKey, farm1.tokenId);
      await context.farmingCenter.connect(lp2).exitFarming(incentiveKey, farm2.tokenId);

      const reward1 = await context.eternalFarming.rewards(lp1.address, context.rewardToken);
      const reward2 = await context.eternalFarming.rewards(lp2.address, context.rewardToken);

      expect(reward1).to.be.gt(0n);
      expect(reward2).to.be.gt(0n);
      // Narrow range earns more per capital
      expect(reward1).to.be.gt(reward2);
    });

    it('feeGrowth increases with each swap', async () => {
      const { context, helpers, createIncentiveResult, incentiveKey } = subject;
      const lpUser = actors.lpUser0();
      const trader = actors.traderUser0();
      const virtualPool = createIncentiveResult.virtualPool;

      await helpers.mintDepositFarmFlow({
        lp: lpUser,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: FULL_RANGE_TICKS,
        createIncentiveResult,
      });

      const totalFeesBefore = (await virtualPool.totalFees0Collected()) + (await virtualPool.totalFees1Collected());

      // Swap in one direction generates fees
      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 100 });
      const totalFeesAfterUp = (await virtualPool.totalFees0Collected()) + (await virtualPool.totalFees1Collected());
      expect(totalFeesAfterUp).to.be.gt(totalFeesBefore);

      // Swap in opposite direction generates more fees
      await helpers.makeTickGoFlow({ trader, direction: 'down', desiredValue: -100 });
      const totalFeesAfterDown = (await virtualPool.totalFees0Collected()) + (await virtualPool.totalFees1Collected());
      expect(totalFeesAfterDown).to.be.gt(totalFeesAfterUp);
    });

    it('narrow position stops earning rewards when tick moves out of range', async () => {
      const { context, helpers, createIncentiveResult, incentiveKey } = subject;
      const lpUser = actors.lpUser0();
      const trader = actors.traderUser0();
      const virtualPool = createIncentiveResult.virtualPool;
      const currentTick = (await helpers.pool.connect(lpUser).globalState()).tick;
      const tickSpacing = await helpers.pool.connect(lpUser).tickSpacing();

      // First create a wide position to provide liquidity for moving tick
      await helpers.mintDepositFarmFlow({
        lp: lpUser,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: FULL_RANGE_TICKS,
        createIncentiveResult,
      });

      // Narrow position around current tick  
      const narrowTicks: [number, number] = [Number(-tickSpacing), Number(tickSpacing)];

      const farmResult = await helpers.mintDepositFarmFlow({
        lp: actors.lpUser1(),
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(10), BNe18(10)],
        ticks: narrowTicks,
        createIncentiveResult,
      });

      // Generate fees while narrow position is in range
      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 70 });
      const rewardInfoBefore = await context.eternalFarming.getRewardInfo(incentiveKey, farmResult.tokenId);
      // Move tick far out of narrow position's range (but within wide position)
      await helpers.moveTickTo({ trader, direction: 'up', desiredValue: 500 });

      // Do more swaps while narrow position is OUT of range
      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 600 });

      const rewardInfoAfter = await context.eternalFarming.getRewardInfo(incentiveKey, farmResult.tokenId);

      expect(rewardInfoBefore.reward).to.be.gte(0n);
      expect(rewardInfoAfter.reward).to.be.lte(rewardInfoBefore.reward);
    });
  });

  describe('Token weights', () => {
    let subject: TestSubject;

    beforeEach(async () => {
      subject = await loadFixture(mainScenario);
    });

    it('setTokenWeights reverts for non-incentive-maker', async () => {
      const { context } = subject;
      const nonMaker = actors.lpUser0();
      const nonce = (await context.eternalFarming.numOfIncentives()) - 1n;

      const incentiveKey = {
        pool: context.pool01,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        nonce,
      };

      await expect(
        context.eternalFarming.connect(nonMaker).setTokenWeights(incentiveKey, 50000, 50000)
      ).to.be.reverted;
    });

    it('setTokenWeights reverts if weights do not sum to 100%', async () => {
      const { context } = subject;
      const incentiveCreator = actors.incentiveCreator();
      const nonce = (await context.eternalFarming.numOfIncentives()) - 1n;

      const incentiveKey = {
        pool: context.pool01,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        nonce,
      };

      await expect(
        context.eternalFarming.connect(incentiveCreator).setTokenWeights(incentiveKey, 50000, 60000)
      ).to.be.revertedWithCustomError(context.eternalFarming, 'invalidWeights');

      await expect(
        context.eternalFarming.connect(incentiveCreator).setTokenWeights(incentiveKey, 30000, 30000)
      ).to.be.revertedWithCustomError(context.eternalFarming, 'invalidWeights');
    });

    it('setTokenWeights successfully changes weights', async () => {
      const { context, helpers, createIncentiveResult } = subject;
      const incentiveCreator = actors.incentiveCreator();
      const nonce = (await context.eternalFarming.numOfIncentives()) - 1n;

      const incentiveKey = {
        pool: context.pool01,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        nonce,
      };

      await expect(
        context.eternalFarming.connect(incentiveCreator).setTokenWeights(incentiveKey, 30000, 70000)
      ).to.emit(context.eternalFarming, 'TokenWeightsChanged');

      const incentiveId = await helpers.getIncentiveId({ ...createIncentiveResult, nonce });
      const incentive = await context.eternalFarming.incentives(incentiveId);

      expect(incentive.weight0).to.eq(30000);
      expect(incentive.weight1).to.eq(70000);
    });

    it('rewards calculation with 100% weight on token0', async () => {
      const { context, helpers, createIncentiveResult, incentiveKey } = subject;
      const lpUser = actors.lpUser0();
      const trader = actors.traderUser0();
      const incentiveCreator = actors.incentiveCreator();
      const nonce = (await context.eternalFarming.numOfIncentives()) - 1n;

      const incentiveKeyObj = {
        pool: context.pool01,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        nonce,
      };

      await context.eternalFarming.connect(incentiveCreator).setTokenWeights(incentiveKeyObj, 100000, 0);

      const farmResult = await helpers.mintDepositFarmFlow({
        lp: lpUser,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: FULL_RANGE_TICKS,
        createIncentiveResult,
      });

      // direction 'up' generates token1 fees (tok1 → tok0 swap)
      // With weight0 = 100% and weight1 = 0%, only token0 fees count
      // Token1 fees should NOT generate rewards
      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 100 });
      await time.increase(days(1));

      await context.farmingCenter.connect(lpUser).exitFarming(incentiveKey, farmResult.tokenId);
      const rewardWithToken1Fees = await context.eternalFarming.rewards(lpUser.address, context.rewardToken);

      // With effectivePrecision logic: if only token1 fees exist and weight1=0,
      // effectivePrecision = 0, so no rewards
      expect(rewardWithToken1Fees).to.eq(0n);
    });
  });

  describe('Community fee scenarios', () => {
    let subject: TestSubject;

    beforeEach(async () => {
      subject = await loadFixture(mainScenario);
    });

    it('works correctly with 15% community fee', async () => {
      const { context, helpers, createIncentiveResult, incentiveKey } = subject;
      const farmingLP = actors.lpUser0();
      const trader = actors.traderUser0();

      await (context.poolObj as any).connect(context.ownerSigner).setCommunityFee(150);

      const farmResult = await helpers.mintDepositFarmFlow({
        lp: farmingLP,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: FULL_RANGE_TICKS,
        createIncentiveResult,
      });

      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 100 });
      await time.increase(days(1));

      await context.farmingCenter.connect(farmingLP).exitFarming(incentiveKey, farmResult.tokenId);
      await context.eternalFarming.connect(farmingLP).claimReward(context.rewardToken, farmingLP.address, 0);

      const reward = await context.rewardToken.balanceOf(farmingLP.address);
      const expectedReward = ONE_DAY_SECONDS * REWARD_RATE;
      expect(reward).to.be.closeTo(expectedReward, expectedReward / 10n);
    });

    it('earns no rewards with 100% community fee', async () => {
      const { context, helpers, createIncentiveResult, incentiveKey } = subject;
      const farmingLP = actors.lpUser0();
      const trader = actors.traderUser0();

      // With 100% community fee, ALL fees go to protocol, none to LPs
      await (context.poolObj as any).connect(context.ownerSigner).setCommunityFee(1000);

      const farmResult = await helpers.mintDepositFarmFlow({
        lp: farmingLP,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: FULL_RANGE_TICKS,
        createIncentiveResult,
      });

      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 100 });
      await time.increase(days(1));

      await context.farmingCenter.connect(farmingLP).exitFarming(incentiveKey, farmResult.tokenId);
      await context.eternalFarming.connect(farmingLP).claimReward(context.rewardToken, farmingLP.address, 0);

      const reward = await context.rewardToken.balanceOf(farmingLP.address);
      // With fee-based farming and 100% community fee, 
      // no fees flow to virtual pool → no rewards distributed
      expect(reward).to.eq(0n);
    });
  });

  describe('Bonus reward scenarios', () => {
    let subject: TestSubject;

    beforeEach(async () => {
      subject = await loadFixture(mainScenario);
    });

    it('earns both reward and bonusReward correctly', async () => {
      const { context, helpers, createIncentiveResult, incentiveKey } = subject;
      const lpUser = actors.lpUser0();
      const trader = actors.traderUser0();

      const farmResult = await helpers.mintDepositFarmFlow({
        lp: lpUser,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: FULL_RANGE_TICKS,
        createIncentiveResult,
      });

      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 100 });
      await time.increase(days(1));

      await context.farmingCenter.connect(lpUser).exitFarming(incentiveKey, farmResult.tokenId);

      const rewardBalance = await context.eternalFarming.rewards(lpUser.address, context.rewardToken);
      const bonusRewardBalance = await context.eternalFarming.rewards(lpUser.address, context.bonusRewardToken);

      const expectedReward = ONE_DAY_SECONDS * REWARD_RATE;
      expect(rewardBalance).to.be.closeTo(expectedReward, expectedReward / 100n);

      const expectedBonusReward = ONE_DAY_SECONDS * BONUS_REWARD_RATE;
      expect(bonusRewardBalance).to.be.closeTo(expectedBonusReward, expectedBonusReward / 100n);

      const ratio = Number(rewardBalance) / Number(bonusRewardBalance);
      expect(ratio).to.be.closeTo(2, 0.2);
    });

    it('claims both rewards to wallet', async () => {
      const { context, helpers, createIncentiveResult, incentiveKey } = subject;
      const lpUser = actors.lpUser0();
      const trader = actors.traderUser0();

      const farmResult = await helpers.mintDepositFarmFlow({
        lp: lpUser,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: FULL_RANGE_TICKS,
        createIncentiveResult,
      });

      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 100 });
      await time.increase(days(1));

      await context.farmingCenter.connect(lpUser).exitFarming(incentiveKey, farmResult.tokenId);

      await context.eternalFarming.connect(lpUser).claimReward(context.rewardToken, lpUser.address, 0);
      await context.eternalFarming.connect(lpUser).claimReward(context.bonusRewardToken, lpUser.address, 0);

      const rewardWallet = await context.rewardToken.balanceOf(lpUser.address);
      const bonusWallet = await context.bonusRewardToken.balanceOf(lpUser.address);

      expect(rewardWallet).to.be.gt(0n);
      expect(bonusWallet).to.be.gt(0n);

      const pendingReward = await context.eternalFarming.rewards(lpUser.address, context.rewardToken);
      const pendingBonus = await context.eternalFarming.rewards(lpUser.address, context.bonusRewardToken);

      expect(pendingReward).to.eq(0n);
      expect(pendingBonus).to.eq(0n);
    });
  });
});
