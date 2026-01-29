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
  mintPosition 
} from './shared';
import { createTimeMachine } from './shared/time';
import { ERC20Helper, HelperCommands, incentiveResultToFarmAdapter } from './helpers';
import { provider } from './shared/provider';
import { ActorFixture } from './shared/actors';
import { HelperTypes } from './helpers/types';
import { Wallet, MaxUint256 } from 'ethers';

describe('FeeBasedFarming Integration', () => {
  let wallets: Wallet[];
  const Time = createTimeMachine();
  let actors: ActorFixture;
  const e20h = new ERC20Helper();

  const TICK_SPACING = TICK_SPACINGS[FeeAmount.MEDIUM];
  const FULL_RANGE_TICKS: [number, number] = [getMinTick(TICK_SPACING), getMaxTick(TICK_SPACING)];
  const TOTAL_REWARD = BNe18(100_000);
  const BONUS_REWARD = BNe18(50_000);
  const REWARD_RATE = BNe18(1); // 1 token per second
  const BONUS_REWARD_RATE = BNe18(1) / 2n;
  const ONE_DAY_SECONDS = 86400n;

  type TestSubject = {
    helpers: HelperCommands;
    context: TestContext;
    createIncentiveResult: HelperTypes.CreateIncentive.Result;
    incentiveKey: any;
  };

  before(async () => {
    wallets = (await (ethers.getSigners() as any)) as Wallet[];
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

  describe('Basic farming lifecycle', () => {
    let subject: TestSubject;

    beforeEach(async () => {
      subject = await loadFixture(mainScenario);
    });

    describe('#createEternalFarming', () => {
      it('creates incentive with correct parameters', async () => {
        const { context, helpers, createIncentiveResult } = subject;
        const nonce = (await context.eternalFarming.numOfIncentives()) - 1n;

        expect(createIncentiveResult.virtualPool).to.not.be.undefined;
        
        const incentiveId = await helpers.getIncentiveId({
          ...createIncentiveResult,
          nonce,
        });
        
        const incentiveData = await context.eternalFarming.incentives(incentiveId);
        expect(incentiveData.rewardRate).to.eq(REWARD_RATE);
        expect(incentiveData.bonusRewardRate).to.eq(BONUS_REWARD_RATE);
        expect(incentiveData.totalReward).to.eq(TOTAL_REWARD);
        expect(incentiveData.bonusReward).to.eq(BONUS_REWARD);
      });
    });

    describe('#enterFarming', () => {
      it('records farm with correct liquidity and timestamp', async () => {
        const { context, helpers, createIncentiveResult, incentiveKey } = subject;
        const lpUser = actors.lpUser0();
        const nonce = (await context.eternalFarming.numOfIncentives()) - 1n;

        await e20h.ensureBalancesAndApprovals(lpUser, [context.token0, context.token1], BNe18(1), await context.nft.getAddress());

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

        await context.nft.connect(lpUser).approveForFarming(tokenId, true, context.farmingCenter);
        await expect(context.farmingCenter.connect(lpUser).enterFarming(incentiveKey, tokenId)).to.not.be.reverted;

        const incentiveId = await helpers.getIncentiveId({ ...createIncentiveResult, nonce });
        const farm = await context.eternalFarming.farms(tokenId, incentiveId);
        
        expect(farm.liquidity).to.be.gt(0);
        expect(farm.timestamp).to.be.gt(0);
        // Initial totalFees should be 1 (initialized value)
        expect(farm.totalFees).to.eq(1n);
      });

      it('records updated totalFees when entering after swaps', async () => {
        const { context, helpers, createIncentiveResult, incentiveKey } = subject;
        const lpUser = actors.lpUser0();
        const trader = actors.traderUser0();
        const nonce = (await context.eternalFarming.numOfIncentives()) - 1n;

        // First position enters and swaps happen
        await e20h.ensureBalancesAndApprovals(lpUser, [context.token0, context.token1], BNe18(2), await context.nft.getAddress());

        const tokenId1 = await mintPosition(context.nft.connect(lpUser), {
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

        const tokenId2 = await mintPosition(context.nft.connect(lpUser), {
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

        await context.nft.connect(lpUser).approveForFarming(tokenId1, true, context.farmingCenter);
        await context.nft.connect(lpUser).approveForFarming(tokenId2, true, context.farmingCenter);
        
        await context.farmingCenter.connect(lpUser).enterFarming(incentiveKey, tokenId1);

        // Generate fees
        await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 10 });
        await helpers.makeTickGoFlow({ trader, direction: 'down', desiredValue: -10 });

        // Second position enters after fees accumulated
        await context.farmingCenter.connect(lpUser).enterFarming(incentiveKey, tokenId2);

        const incentiveId = await helpers.getIncentiveId({ ...createIncentiveResult, nonce });
        const farm2 = await context.eternalFarming.farms(tokenId2, incentiveId);

        // totalFees and innerFeeGrowth should reflect accumulated fees
        expect(farm2.totalFees).to.be.gt(1n);
        expect(farm2.innerFeeGrowth).to.be.gt(1n);
      });
    });

    describe('#collectRewards and #exitFarming', () => {
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

        // Generate fees via swaps
        await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 100 });
        await helpers.makeTickGoFlow({ trader, direction: 'down', desiredValue: -100 });

        await time.increase(days(1));

        await context.farmingCenter.connect(lpUser).exitFarming(incentiveKey, farmResult.tokenId);
        
        const rewardBalance = await context.eternalFarming.rewards(lpUser.address, context.rewardToken);
        const expectedReward = ONE_DAY_SECONDS * REWARD_RATE;
        
        // Should earn ~100% of daily rewards (within 0.1% tolerance)
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
        await time.increase(3600); // 1 hour
        await context.farmingCenter.connect(lpUser).collectRewards(incentiveKey, farmResult.tokenId);
        const rewards1 = await context.eternalFarming.rewards(lpUser.address, context.rewardToken);

        // Second period
        await helpers.makeTickGoFlow({ trader, direction: 'down', desiredValue: -50 });
        await time.increase(3600); // 1 hour
        await context.farmingCenter.connect(lpUser).collectRewards(incentiveKey, farmResult.tokenId);
        const rewards2 = await context.eternalFarming.rewards(lpUser.address, context.rewardToken);

        // Second collection should have more rewards
        expect(rewards2).to.be.gt(rewards1);
        
        // Each hour should earn ~3600 tokens
        const hourlyReward = 3600n * REWARD_RATE;
        expect(rewards1).to.be.closeTo(hourlyReward, hourlyReward / 10n);
        expect(rewards2).to.be.closeTo(hourlyReward * 2n, hourlyReward / 5n);
      });
    });
  });

  describe('Multiple LPs - proportional reward distribution', () => {
    let subject: TestSubject;

    beforeEach(async () => {
      subject = await loadFixture(mainScenario);
    });

    it('distributes rewards in 3:1 ratio for 3x:1x liquidity positions', async () => {
      const { context, helpers, createIncentiveResult, incentiveKey } = subject;
      const lpUser1 = actors.lpUser0();
      const lpUser2 = actors.lpUser1();
      const trader = actors.traderUser0();

      // LP1: 1x liquidity
      const farm1 = await helpers.mintDepositFarmFlow({
        lp: lpUser1,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(1), BNe18(1)],
        ticks: FULL_RANGE_TICKS,
        createIncentiveResult,
      });

      // LP2: 3x liquidity
      const farm2 = await helpers.mintDepositFarmFlow({
        lp: lpUser2,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(3), BNe18(3)],
        ticks: FULL_RANGE_TICKS,
        createIncentiveResult,
      });

      // Generate fees
      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 100 });
      await helpers.makeTickGoFlow({ trader, direction: 'down', desiredValue: -100 });

      await time.increase(days(1));

      await context.farmingCenter.connect(lpUser1).exitFarming(incentiveKey, farm1.tokenId);
      await context.farmingCenter.connect(lpUser2).exitFarming(incentiveKey, farm2.tokenId);

      await context.eternalFarming.connect(lpUser1).claimReward(context.rewardToken, lpUser1.address, 0);
      await context.eternalFarming.connect(lpUser2).claimReward(context.rewardToken, lpUser2.address, 0);

      const balance1 = await context.rewardToken.balanceOf(lpUser1.address);
      const balance2 = await context.rewardToken.balanceOf(lpUser2.address);

      // Ratio should be ~3:1
      const ratio = Number(balance2) / Number(balance1);
      expect(ratio).to.be.closeTo(3, 0.1);

      // Total should be ~100% of daily rewards
      const totalRewards = balance1 + balance2;
      const expectedTotal = ONE_DAY_SECONDS * REWARD_RATE;
      expect(totalRewards).to.be.closeTo(expectedTotal, expectedTotal / 100n);
    });

    it('distributes rewards correctly when one LP exits mid-way', async () => {
      const { context, helpers, createIncentiveResult, incentiveKey } = subject;
      const lpUser1 = actors.lpUser0();
      const lpUser2 = actors.lpUser1();
      const trader = actors.traderUser0();

      // Both enter with equal liquidity
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

      // First day - both farming
      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 50 });
      await time.increase(days(1));

      // LP1 exits
      await context.farmingCenter.connect(lpUser1).exitFarming(incentiveKey, farm1.tokenId);

      // Second day - only LP2
      await helpers.makeTickGoFlow({ trader, direction: 'down', desiredValue: -50 });
      await time.increase(days(1));

      await context.farmingCenter.connect(lpUser2).exitFarming(incentiveKey, farm2.tokenId);

      const reward1 = await context.eternalFarming.rewards(lpUser1.address, context.rewardToken);
      const reward2 = await context.eternalFarming.rewards(lpUser2.address, context.rewardToken);

      // LP1 should have less rewards (only farmed first day at 50%)
      // LP2 should have more rewards (farmed both days, 100% on second day)
      expect(reward1).to.be.gt(0n);
      expect(reward2).to.be.gt(reward1);

      // LP2 should have significantly more (roughly 3x)
      const ratio = Number(reward2) / Number(reward1);
      expect(ratio).to.be.gt(2);
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

      // No swaps, just time passes
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

      // Mint OUT-OF-RANGE position (far above current price)
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

      // Swaps don't cross into position range
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

      // Mint position but don't enter farming yet
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

      // Pre-entry swaps (shouldn't count)
      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 50 });

      // totalFees before entry should be initial value (1)
      const feesBefore = await virtualPool.totalFees();
      expect(feesBefore).to.eq(1n);

      // Enter farming
      await context.nft.connect(lpUser).approveForFarming(tokenId, true, context.farmingCenter);
      await context.farmingCenter.connect(lpUser).enterFarming(incentiveKey, tokenId);

      // Post-entry swaps (should count)
      await helpers.makeTickGoFlow({ trader, direction: 'down', desiredValue: -50 });

      const feesAfter = await virtualPool.totalFees();
      expect(feesAfter).to.be.gt(feesBefore);

      await time.increase(days(1));

      await context.farmingCenter.connect(lpUser).exitFarming(incentiveKey, tokenId);
      await context.eternalFarming.connect(lpUser).claimReward(context.rewardToken, lpUser.address, 0);

      const reward = await context.rewardToken.balanceOf(lpUser.address);
      // Should earn rewards proportional to post-entry fees only
      expect(reward).to.be.gt(0n);
    });
  });

  describe('Partial liquidity in farming', () => {
    let subject: TestSubject;

    beforeEach(async () => {
      subject = await loadFixture(mainScenario);
    });

    it('virtual pool tracks only farming liquidity, not total pool liquidity', async () => {
      const { context, helpers, createIncentiveResult } = subject;
      const virtualPool = createIncentiveResult.virtualPool;
      const farmingLP = actors.lpUser0();
      const regularLP = actors.lpUser1();

      // Regular LP: large liquidity, NOT in farming
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

      // Farming LP: small liquidity, IN farming
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

      // Virtual pool should have MUCH less liquidity than real pool
      expect(virtualLiquidity).to.be.lt(realLiquidity);
      // Approximately 100/(100+500) = ~16.7% of pool liquidity
      const ratio = Number(virtualLiquidity) / Number(realLiquidity);
      expect(ratio).to.be.closeTo(0.167, 0.05);
    });

    it('single farming position earns 100% of rewards despite small pool share', async () => {
      const { context, helpers, createIncentiveResult, incentiveKey } = subject;
      const farmingLP = actors.lpUser0();
      const regularLP = actors.lpUser1();
      const trader = actors.traderUser0();

      // Regular LP: 90% of pool liquidity
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

      // Farming LP: 10% of pool liquidity but 100% of farming
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
      // Should earn ~100% of daily rewards (the only farmer)
      const expectedReward = ONE_DAY_SECONDS * REWARD_RATE;
      expect(reward).to.be.closeTo(expectedReward, expectedReward / 50n);
    });
  });

  describe('Tick crossing scenarios', () => {
    let subject: TestSubject;

    beforeEach(async () => {
      subject = await loadFixture(mainScenario);
    });

    it('swap generates fees and updates totalFees in virtual pool', async () => {
      const { context, helpers, createIncentiveResult, incentiveKey } = subject;
      const lpUser = actors.lpUser0();
      const trader = actors.traderUser0();
      const virtualPool = createIncentiveResult.virtualPool;

      // Full range position to ensure liquidity is always active
      const farmResult = await helpers.mintDepositFarmFlow({
        lp: lpUser,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: FULL_RANGE_TICKS,
        createIncentiveResult,
      });

      const totalFeesBefore = await virtualPool.totalFees();
      const liquidityBefore = await virtualPool.currentLiquidity();
      expect(liquidityBefore).to.be.gt(0n);

      // Swap to generate fees
      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 100 });

      const totalFeesAfter = await virtualPool.totalFees();

      // Fees accumulated during the swap
      expect(totalFeesAfter).to.be.gt(totalFeesBefore);

      await time.increase(days(1));

      await context.farmingCenter.connect(lpUser).exitFarming(incentiveKey, farmResult.tokenId);
      
      const reward = await context.eternalFarming.rewards(lpUser.address, context.rewardToken);
      // Should have earned rewards
      expect(reward).to.be.gt(0n);
    });

    it('out-of-range farming position earns zero rewards until price enters', async () => {
      const { context, helpers, createIncentiveResult, incentiveKey } = subject;
      const farmingLP = actors.lpUser0();
      const regularLP = actors.lpUser1();
      const trader = actors.traderUser0();

      // Regular LP: full range position NOT in farming (provides liquidity for swaps)
      await e20h.ensureBalancesAndApprovals(regularLP, [context.token0, context.token1], BNe18(500), await context.nft.getAddress());

      await mintPosition(context.nft.connect(regularLP), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: FULL_RANGE_TICKS[0],
        tickUpper: FULL_RANGE_TICKS[1],
        recipient: regularLP.address,
        amount0Desired: BNe18(200),
        amount1Desired: BNe18(200),
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 10000,
      });

      // Farming LP: position far above current price [6000, 12000] IN farming
      await e20h.ensureBalancesAndApprovals(farmingLP, [context.token0, context.token1], BNe18(200), await context.nft.getAddress());

      const tokenIdFarming = await mintPosition(context.nft.connect(farmingLP), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: 6000,
        tickUpper: 12000,
        recipient: farmingLP.address,
        amount0Desired: BNe18(100),
        amount1Desired: 0, // one-sided above current price
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 10000,
      });

      await context.nft.connect(farmingLP).approveForFarming(tokenIdFarming, true, context.farmingCenter);
      await context.farmingCenter.connect(farmingLP).enterFarming(incentiveKey, tokenIdFarming);

      // Swaps happen but don't reach farming position range
      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 100 });
      await helpers.makeTickGoFlow({ trader, direction: 'down', desiredValue: -100 });

      await time.increase(days(1));

      await context.farmingCenter.connect(farmingLP).exitFarming(incentiveKey, tokenIdFarming);

      const reward = await context.eternalFarming.rewards(farmingLP.address, context.rewardToken);
      // Out-of-range position should earn 0 rewards
      expect(reward).to.eq(0n);
    });

    it('two positions at different ranges earn rewards proportionally', async () => {
      const { context, helpers, createIncentiveResult, incentiveKey } = subject;
      const lp1 = actors.lpUser0();
      const lp2 = actors.lpUser1();
      const trader = actors.traderUser0();

      // Two simple positions - one narrow, one wide
      const farm1 = await helpers.mintDepositFarmFlow({
        lp: lp1,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: [-120, 120] as [number, number], // narrow
        createIncentiveResult,
      });

      const farm2 = await helpers.mintDepositFarmFlow({
        lp: lp2,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: FULL_RANGE_TICKS, // full range
        createIncentiveResult,
      });

      // Swap to generate fees
      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 50 });
      await helpers.makeTickGoFlow({ trader, direction: 'down', desiredValue: -50 });

      await time.increase(days(1));

      await context.farmingCenter.connect(lp1).exitFarming(incentiveKey, farm1.tokenId);
      await context.farmingCenter.connect(lp2).exitFarming(incentiveKey, farm2.tokenId);

      const reward1 = await context.eternalFarming.rewards(lp1.address, context.rewardToken);
      const reward2 = await context.eternalFarming.rewards(lp2.address, context.rewardToken);

      // Both should have earned rewards
      expect(reward1).to.be.gt(0n);
      expect(reward2).to.be.gt(0n);

      // Narrow range should earn MORE per capital (higher concentration)
      expect(reward1).to.be.gt(reward2);
    });

    it('multiple farming positions with same range share rewards equally', async () => {
      const { context, helpers, createIncentiveResult, incentiveKey } = subject;
      const lp1 = actors.lpUser0();
      const lp2 = actors.lpUser1();
      const trader = actors.traderUser0();

      // Two positions with same range and liquidity
      const farm1 = await helpers.mintDepositFarmFlow({
        lp: lp1,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: FULL_RANGE_TICKS,
        createIncentiveResult,
      });

      const farm2 = await helpers.mintDepositFarmFlow({
        lp: lp2,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: FULL_RANGE_TICKS,
        createIncentiveResult,
      });

      // Generate fees
      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 50 });

      await time.increase(days(1));

      await context.farmingCenter.connect(lp1).exitFarming(incentiveKey, farm1.tokenId);
      await context.farmingCenter.connect(lp2).exitFarming(incentiveKey, farm2.tokenId);

      const reward1 = await context.eternalFarming.rewards(lp1.address, context.rewardToken);
      const reward2 = await context.eternalFarming.rewards(lp2.address, context.rewardToken);

      // Both should have earned roughly equal rewards
      expect(reward1).to.be.gt(0n);
      expect(reward2).to.be.gt(0n);

      // Ratio should be close to 1
      const ratio = Number(reward1) / Number(reward2);
      expect(ratio).to.be.closeTo(1, 0.1);
    });

    it('virtual pool does not cross when pool crosses tick with no farming liquidity', async () => {
      const { context, helpers, createIncentiveResult, incentiveKey } = subject;
      const farmingLP = actors.lpUser0();
      const regularLP = actors.lpUser1();
      const trader = actors.traderUser0();
      const virtualPool = createIncentiveResult.virtualPool;

      // Regular LP at current price (NOT in farming)
      await e20h.ensureBalancesAndApprovals(regularLP, [context.token0, context.token1], BNe18(200), await context.nft.getAddress());

      await mintPosition(context.nft.connect(regularLP), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: -60,
        tickUpper: 60,
        recipient: regularLP.address,
        amount0Desired: BNe18(100),
        amount1Desired: BNe18(100),
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 10000,
      });

      // Farming LP far above current price [600, 720]
      await e20h.ensureBalancesAndApprovals(farmingLP, [context.token0, context.token1], BNe18(200), await context.nft.getAddress());

      const tokenIdFarming = await mintPosition(context.nft.connect(farmingLP), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: 600,
        tickUpper: 720,
        recipient: farmingLP.address,
        amount0Desired: BNe18(100),
        amount1Desired: 0,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 10000,
      });

      await context.nft.connect(farmingLP).approveForFarming(tokenIdFarming, true, context.farmingCenter);
      await context.farmingCenter.connect(farmingLP).enterFarming(incentiveKey, tokenIdFarming);

      // Virtual pool has 0 liquidity (farming position is far out of range)
      const virtualLiqBefore = await virtualPool.currentLiquidity();
      expect(virtualLiqBefore).to.eq(0n);

      // Swap crosses tick 60 in real pool (regular LP position)
      // But virtual pool has no liquidity at these ticks, so no cross in virtual pool
      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 90 });

      // Virtual pool still has 0 liquidity (we haven't reached farming position)
      const virtualLiqAfter = await virtualPool.currentLiquidity();
      expect(virtualLiqAfter).to.eq(0n);

      await time.increase(days(1));

      await context.farmingCenter.connect(farmingLP).exitFarming(incentiveKey, tokenIdFarming);
      
      const reward = await context.eternalFarming.rewards(farmingLP.address, context.rewardToken);
      // Farming position earned 0 - price never entered its range
      expect(reward).to.eq(0n);
    });

    it('totalFees increases with each swap', async () => {
      const { context, helpers, createIncentiveResult, incentiveKey } = subject;
      const lpUser = actors.lpUser0();
      const trader = actors.traderUser0();
      const virtualPool = createIncentiveResult.virtualPool;

      // Full range position to ensure we always have liquidity
      const farmResult = await helpers.mintDepositFarmFlow({
        lp: lpUser,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: FULL_RANGE_TICKS,
        createIncentiveResult,
      });

      const feesBefore = await virtualPool.totalFees();

      // Swap UP
      await helpers.makeTickGoFlow({ trader, direction: 'up', desiredValue: 100 });

      const feesAfterUp = await virtualPool.totalFees();
      expect(feesAfterUp).to.be.gt(feesBefore);

      // Swap DOWN
      await helpers.makeTickGoFlow({ trader, direction: 'down', desiredValue: -100 });

      const feesAfterDown = await virtualPool.totalFees();
      expect(feesAfterDown).to.be.gt(feesAfterUp);

      await time.increase(days(1));

      await context.farmingCenter.connect(lpUser).exitFarming(incentiveKey, farmResult.tokenId);

      const reward = await context.eternalFarming.rewards(lpUser.address, context.rewardToken);
      // Should have earned rewards
      expect(reward).to.be.gt(0n);
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

      // Enable community fee (15%)
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
      
      // Should earn ~100% of daily rewards (community fee doesn't affect farming rewards directly)
      // The community fee affects pool fees, but farming rewards are based on fee growth
      const expectedReward = ONE_DAY_SECONDS * REWARD_RATE;
      expect(reward).to.be.closeTo(expectedReward, expectedReward / 10n);
    });


    it('earns rewards with 100% community fee', async () => {
      const { context, helpers, createIncentiveResult, incentiveKey } = subject;
      const farmingLP = actors.lpUser0();
      const trader = actors.traderUser0();

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
      expect(reward).to.be.gt(0n);
      console.log('100% community fee reward:', reward.toString());
    });

    it('compares rewards with and without community fee', async () => {
      // First scenario: no community fee
      const subject1 = await loadFixture(mainScenario);
      const { context: ctx1, helpers: h1, createIncentiveResult: cir1, incentiveKey: ik1 } = subject1;
      
      const lp1 = actors.lpUser0();
      const trader1 = actors.traderUser0();

      const farm1 = await h1.mintDepositFarmFlow({
        lp: lp1,
        tokensToFarm: [ctx1.token0, ctx1.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: FULL_RANGE_TICKS,
        createIncentiveResult: cir1,
      });

      await h1.makeTickGoFlow({ trader: trader1, direction: 'up', desiredValue: 50 });
      await time.increase(days(1));

      await ctx1.farmingCenter.connect(lp1).exitFarming(ik1, farm1.tokenId);
      await ctx1.eternalFarming.connect(lp1).claimReward(ctx1.rewardToken, lp1.address, 0);
      const rewardNoCommunity = await ctx1.rewardToken.balanceOf(lp1.address);

      // Second scenario: 50% community fee
      const subject2 = await loadFixture(mainScenario);
      const { context: ctx2, helpers: h2, createIncentiveResult: cir2, incentiveKey: ik2 } = subject2;

      await (ctx2.poolObj as any).connect(ctx2.ownerSigner).setCommunityFee(500);

      const lp2 = actors.lpUser1();
      const trader2 = actors.traderUser1();

      const farm2 = await h2.mintDepositFarmFlow({
        lp: lp2,
        tokensToFarm: [ctx2.token0, ctx2.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: FULL_RANGE_TICKS,
        createIncentiveResult: cir2,
      });

      await h2.makeTickGoFlow({ trader: trader2, direction: 'up', desiredValue: 50 });
      await time.increase(days(1));

      await ctx2.farmingCenter.connect(lp2).exitFarming(ik2, farm2.tokenId);
      await ctx2.eternalFarming.connect(lp2).claimReward(ctx2.rewardToken, lp2.address, 0);
      const rewardWithCommunity = await ctx2.rewardToken.balanceOf(lp2.address);

      // Both should have rewards close to expected daily amount
      const expectedReward = ONE_DAY_SECONDS * REWARD_RATE;
      expect(rewardNoCommunity).to.be.closeTo(expectedReward, expectedReward / 10n);
      expect(rewardWithCommunity).to.be.closeTo(expectedReward, expectedReward / 5n);

      console.log('Reward without community fee:', rewardNoCommunity.toString());
      console.log('Reward with 50% community fee:', rewardWithCommunity.toString());
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

      // Check main reward
      const expectedReward = ONE_DAY_SECONDS * REWARD_RATE;
      expect(rewardBalance).to.be.closeTo(expectedReward, expectedReward / 100n);

      // Check bonus reward (half rate)
      const expectedBonusReward = ONE_DAY_SECONDS * BONUS_REWARD_RATE;
      expect(bonusRewardBalance).to.be.closeTo(expectedBonusReward, expectedBonusReward / 100n);

      // Ratio should be ~2:1 (reward:bonus based on rates)
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

      // Claim both rewards
      await context.eternalFarming.connect(lpUser).claimReward(context.rewardToken, lpUser.address, 0);
      await context.eternalFarming.connect(lpUser).claimReward(context.bonusRewardToken, lpUser.address, 0);

      const rewardWallet = await context.rewardToken.balanceOf(lpUser.address);
      const bonusWallet = await context.bonusRewardToken.balanceOf(lpUser.address);

      expect(rewardWallet).to.be.gt(0n);
      expect(bonusWallet).to.be.gt(0n);

      // Pendng rewards should be 0 after claim
      const pendingReward = await context.eternalFarming.rewards(lpUser.address, context.rewardToken);
      const pendingBonus = await context.eternalFarming.rewards(lpUser.address, context.bonusRewardToken);
      
      expect(pendingReward).to.eq(0n);
      expect(pendingBonus).to.eq(0n);
    });
  });
});
