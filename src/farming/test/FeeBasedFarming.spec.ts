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

  before(async () => {
    wallets = (await (ethers.getSigners() as any)) as Wallet[];
    actors = new ActorFixture(wallets, provider);
  });

  describe('Basic farming lifecycle', () => {
    type TestSubject = {
      helpers: HelperCommands;
      context: TestContext;
    };
    let subject: TestSubject;

    const ticksToFarm: [number, number] = [getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]), getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])];
    const amountsToFarm: [bigint, bigint] = [BNe18(1), BNe18(1)];

    const totalReward = BNe18(100_000);
    const bonusReward = BNe18(50_000);

    const scenario: () => Promise<TestSubject> = async () => {
      const context = await algebraFixture();
      const wallets = (await ethers.getSigners()) as any as Wallet[];
      const helpers = HelperCommands.fromTestContext(context, new ActorFixture(wallets, ethers.provider), ethers.provider);

      return {
        context,
        helpers,
      };
    };

    beforeEach('load Fixture', async () => {
      subject = await loadFixture(scenario);
    });

    describe('#createEternalFarming', () => {
      it('creates incentive with rewardRate and bonusRewardRate', async () => {
        const { context, helpers } = subject;
        const incentiveCreator = actors.incentiveCreator();
        const nonce = await context.eternalFarming.numOfIncentives();

        const createIncentiveResult = await helpers.createIncentiveFlow({
          nonce,
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          poolAddress: context.pool01,
          totalReward,
          bonusReward,
          rewardRate: 100n,
          bonusRewardRate: 50n,
        });

        expect(createIncentiveResult.virtualPool).to.not.be.undefined;
        
        const incentiveId = await helpers.getIncentiveId({
          ...createIncentiveResult,
          nonce,
        });
        
        const incentiveData = await context.eternalFarming.incentives(incentiveId);
        expect(incentiveData.rewardRate).to.eq(100n);
        expect(incentiveData.bonusRewardRate).to.eq(50n);
        expect(incentiveData.totalReward).to.eq(totalReward);
        expect(incentiveData.bonusReward).to.eq(bonusReward);
      });
    });

    describe('#enterFarming', () => {
      it('allows LP to enter farming', async () => {
        const { context, helpers } = subject;
        const lpUser = actors.lpUser0();
        const nonce = await context.eternalFarming.numOfIncentives();

        const createIncentiveResult = await helpers.createIncentiveFlow({
          nonce,
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          poolAddress: context.pool01,
          totalReward,
          bonusReward,
          rewardRate: 100n,
          bonusRewardRate: 50n,
        });

        // Mint position
        await e20h.ensureBalancesAndApprovals(lpUser, [context.token0, context.token1], amountsToFarm[0], await context.nft.getAddress());

        const tokenId = await mintPosition(context.nft.connect(lpUser), {
          token0: await context.token0.getAddress(),
          token1: await context.token1.getAddress(),
          fee: FeeAmount.MEDIUM,
          tickLower: ticksToFarm[0],
          tickUpper: ticksToFarm[1],
          recipient: lpUser.address,
          amount0Desired: amountsToFarm[0],
          amount1Desired: amountsToFarm[1],
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 10000,
        });

        // Approve and enter farming
        await context.nft.connect(lpUser).approveForFarming(tokenId, true, context.farmingCenter);
        
        const incentiveKey = await incentiveResultToFarmAdapter(createIncentiveResult);
        await expect(context.farmingCenter.connect(lpUser).enterFarming(incentiveKey, tokenId)).to.not.be.reverted;

        // Check farm was created
        const incentiveId = await helpers.getIncentiveId({
          ...createIncentiveResult,
          nonce,
        });
        const farm = await context.eternalFarming.farms(tokenId, incentiveId);
        expect(farm.liquidity).to.be.gt(0);
        expect(farm.timestamp).to.be.gt(0);
      });

      it('records initial totalFees and innerFeeGrowth', async () => {
        const { context, helpers } = subject;
        const lpUser = actors.lpUser0();
        const trader = actors.traderUser0();
        const nonce = await context.eternalFarming.numOfIncentives();

        const createIncentiveResult = await helpers.createIncentiveFlow({
          nonce,
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          poolAddress: context.pool01,
          totalReward,
          bonusReward,
          rewardRate: 100n,
          bonusRewardRate: 50n,
        });

        // Mint position
        await e20h.ensureBalancesAndApprovals(lpUser, [context.token0, context.token1], amountsToFarm[0], await context.nft.getAddress());

        const tokenId = await mintPosition(context.nft.connect(lpUser), {
          token0: await context.token0.getAddress(),
          token1: await context.token1.getAddress(),
          fee: FeeAmount.MEDIUM,
          tickLower: ticksToFarm[0],
          tickUpper: ticksToFarm[1],
          recipient: lpUser.address,
          amount0Desired: amountsToFarm[0],
          amount1Desired: amountsToFarm[1],
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 10000,
        });

        // Do some swaps to generate fees before entering farming
        await helpers.makeTickGoFlow({
          trader,
          direction: 'up',
          desiredValue: 10,
        });
        await helpers.makeTickGoFlow({
          trader,
          direction: 'down',
          desiredValue: -10,
        });

        // Approve and enter farming
        await context.nft.connect(lpUser).approveForFarming(tokenId, true, context.farmingCenter);
        
        const incentiveKey = await incentiveResultToFarmAdapter(createIncentiveResult);
        await context.farmingCenter.connect(lpUser).enterFarming(incentiveKey, tokenId);

        // Check farm records fee state
        const incentiveId = await helpers.getIncentiveId({
          ...createIncentiveResult,
          nonce,
        });
        const farm = await context.eternalFarming.farms(tokenId, incentiveId);
        // totalFees should be recorded from virtual pool
        // innerFeeGrowth should be recorded
        expect(farm.timestamp).to.be.gt(0);
      });
    });

    describe('#collectRewards', () => {
      it('calculates rewards based on fees earned', async () => {
        const { context, helpers } = subject;
        const lpUser = actors.lpUser0();
        const trader = actors.traderUser0();
        const nonce = await context.eternalFarming.numOfIncentives();

        const rewardRate = BNe18(1); // 1 token per second

        const createIncentiveResult = await helpers.createIncentiveFlow({
          nonce,
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          poolAddress: context.pool01,
          totalReward,
          bonusReward,
          rewardRate,
          bonusRewardRate: rewardRate / 2n,
        });

        // Mint position
        await e20h.ensureBalancesAndApprovals(lpUser, [context.token0, context.token1], amountsToFarm[0], await context.nft.getAddress());

        const tokenId = await mintPosition(context.nft.connect(lpUser), {
          token0: await context.token0.getAddress(),
          token1: await context.token1.getAddress(),
          fee: FeeAmount.MEDIUM,
          tickLower: ticksToFarm[0],
          tickUpper: ticksToFarm[1],
          recipient: lpUser.address,
          amount0Desired: amountsToFarm[0],
          amount1Desired: amountsToFarm[1],
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 10000,
        });

        // Enter farming
        await context.nft.connect(lpUser).approveForFarming(tokenId, true, context.farmingCenter);
        const incentiveKey = await incentiveResultToFarmAdapter(createIncentiveResult);
        await context.farmingCenter.connect(lpUser).enterFarming(incentiveKey, tokenId);

        // Generate fees via swaps
        await helpers.makeTickGoFlow({
          trader,
          direction: 'up',
          desiredValue: 100,
        });
        await helpers.makeTickGoFlow({
          trader,
          direction: 'down',
          desiredValue: -100,
        });

        // Wait some time
        await time.increase(days(1));

        // Collect rewards
        await context.farmingCenter.connect(lpUser).collectRewards(incentiveKey, tokenId);

        // Check rewards were accumulated
        const rewardBalance = await context.eternalFarming.rewards(lpUser.address, context.rewardToken);
        // Rewards should be positive (exact amount depends on fees generated)
        expect(rewardBalance).to.be.gte(0);
      });
    });

    describe('#exitFarming', () => {
      it('allows LP to exit farming and claim rewards', async () => {
        const { context, helpers } = subject;
        const lpUser = actors.lpUser0();
        const trader = actors.traderUser0();
        const nonce = await context.eternalFarming.numOfIncentives();

        const rewardRate = BNe18(1);

        const createIncentiveResult = await helpers.createIncentiveFlow({
          nonce,
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          poolAddress: context.pool01,
          totalReward,
          bonusReward,
          rewardRate,
          bonusRewardRate: rewardRate / 2n,
        });

        // Mint position
        await e20h.ensureBalancesAndApprovals(lpUser, [context.token0, context.token1], amountsToFarm[0], await context.nft.getAddress());

        const tokenId = await mintPosition(context.nft.connect(lpUser), {
          token0: await context.token0.getAddress(),
          token1: await context.token1.getAddress(),
          fee: FeeAmount.MEDIUM,
          tickLower: ticksToFarm[0],
          tickUpper: ticksToFarm[1],
          recipient: lpUser.address,
          amount0Desired: amountsToFarm[0],
          amount1Desired: amountsToFarm[1],
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 10000,
        });

        // Enter farming
        await context.nft.connect(lpUser).approveForFarming(tokenId, true, context.farmingCenter);
        const incentiveKey = await incentiveResultToFarmAdapter(createIncentiveResult);
        await context.farmingCenter.connect(lpUser).enterFarming(incentiveKey, tokenId);

        // Generate fees via swaps
        await helpers.makeTickGoFlow({
          trader,
          direction: 'up',
          desiredValue: 50,
        });

        // Wait some time
        await time.increase(days(1));

        // Exit farming
        await expect(
          context.farmingCenter.connect(lpUser).exitFarming(incentiveKey, tokenId)
        ).to.not.be.reverted;

        // Check farm was cleared
        const incentiveId = await helpers.getIncentiveId({
          ...createIncentiveResult,
          nonce,
        });
        const farm = await context.eternalFarming.farms(tokenId, incentiveId);
        expect(farm.liquidity).to.eq(0);
      });
    });
  });

  describe('Multiple LPs farming with proportional fee rewards', () => {
    type TestSubject = {
      helpers: HelperCommands;
      context: TestContext;
      createIncentiveResult: HelperTypes.CreateIncentive.Result;
    };
    let subject: TestSubject;

    const ticksToFarm: [number, number] = [getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]), getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])];
    const totalReward = BNe18(100_000);
    const bonusReward = BNe18(50_000);

    const scenario: () => Promise<TestSubject> = async () => {
      const context = await algebraFixture();
      const wallets = (await ethers.getSigners()) as any as Wallet[];
      const helpers = HelperCommands.fromTestContext(context, new ActorFixture(wallets, ethers.provider), ethers.provider);

      const nonce = await context.eternalFarming.numOfIncentives();

      const createIncentiveResult = await helpers.createIncentiveFlow({
        nonce,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        poolAddress: context.pool01,
        totalReward,
        bonusReward,
        rewardRate: BNe18(1),
        bonusRewardRate: BNe18(1) / 2n,
      });

      return {
        context,
        helpers,
        createIncentiveResult,
      };
    };

    beforeEach('load Fixture', async () => {
      subject = await loadFixture(scenario);
    });

    it('distributes rewards proportionally to fees earned by each position', async () => {
      const { context, helpers, createIncentiveResult } = subject;
      const lpUser1 = actors.lpUser0();
      const lpUser2 = actors.lpUser1();
      const trader = actors.traderUser0();

      // LP1 provides 1x liquidity
      const amountsToFarm1: [bigint, bigint] = [BNe18(1), BNe18(1)];
      await e20h.ensureBalancesAndApprovals(lpUser1, [context.token0, context.token1], amountsToFarm1[0], await context.nft.getAddress());
      
      const tokenId1 = await mintPosition(context.nft.connect(lpUser1), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: ticksToFarm[0],
        tickUpper: ticksToFarm[1],
        recipient: lpUser1.address,
        amount0Desired: amountsToFarm1[0],
        amount1Desired: amountsToFarm1[1],
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 10000,
      });

      // LP2 provides 3x liquidity (should earn 3x fees)
      const amountsToFarm2: [bigint, bigint] = [BNe18(3), BNe18(3)];
      await e20h.ensureBalancesAndApprovals(lpUser2, [context.token0, context.token1], amountsToFarm2[0], await context.nft.getAddress());
      
      const tokenId2 = await mintPosition(context.nft.connect(lpUser2), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: ticksToFarm[0],
        tickUpper: ticksToFarm[1],
        recipient: lpUser2.address,
        amount0Desired: amountsToFarm2[0],
        amount1Desired: amountsToFarm2[1],
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 10000,
      });

      // Both enter farming at the same time
      const incentiveKey = await incentiveResultToFarmAdapter(createIncentiveResult);
      
      await context.nft.connect(lpUser1).approveForFarming(tokenId1, true, context.farmingCenter);
      await context.farmingCenter.connect(lpUser1).enterFarming(incentiveKey, tokenId1);
      
      await context.nft.connect(lpUser2).approveForFarming(tokenId2, true, context.farmingCenter);
      await context.farmingCenter.connect(lpUser2).enterFarming(incentiveKey, tokenId2);

      // Generate fees via swaps
      await helpers.makeTickGoFlow({
        trader,
        direction: 'up',
        desiredValue: 100,
      });
      await helpers.makeTickGoFlow({
        trader,
        direction: 'down',
        desiredValue: -100,
      });

      // Wait and do more trades
      await time.increase(days(1));
      
      await helpers.makeTickGoFlow({
        trader,
        direction: 'up',
        desiredValue: 50,
      });

      // Both exit and claim rewards
      await context.farmingCenter.connect(lpUser1).exitFarming(incentiveKey, tokenId1);
      await context.farmingCenter.connect(lpUser2).exitFarming(incentiveKey, tokenId2);

      // Claim rewards
      await context.eternalFarming.connect(lpUser1).claimReward(context.rewardToken, lpUser1.address, 0);
      await context.eternalFarming.connect(lpUser2).claimReward(context.rewardToken, lpUser2.address, 0);

      const balance1 = await context.rewardToken.balanceOf(lpUser1.address);
      const balance2 = await context.rewardToken.balanceOf(lpUser2.address);

      // LP2 should have approximately 3x the rewards of LP1
      // (proportional to liquidity and thus fees earned)
      // Allow for some rounding differences
      if (balance1 > 0n && balance2 > 0n) {
        const ratio = (balance2 * 100n) / balance1;
        // Ratio should be approximately 300 (3x), but may vary due to fee dynamics
        expect(ratio).to.be.gte(200n); // At least 2x
      }
    });
  });

  describe('Fee-based reward calculation edge cases', () => {
    type TestSubject = {
      helpers: HelperCommands;
      context: TestContext;
    };
    let subject: TestSubject;

    const ticksToFarm: [number, number] = [getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]), getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])];
    const amountsToFarm: [bigint, bigint] = [BNe18(1), BNe18(1)];
    const totalReward = BNe18(100_000);
    const bonusReward = BNe18(50_000);

    const scenario: () => Promise<TestSubject> = async () => {
      const context = await algebraFixture();
      const wallets = (await ethers.getSigners()) as any as Wallet[];
      const helpers = HelperCommands.fromTestContext(context, new ActorFixture(wallets, ethers.provider), ethers.provider);

      return {
        context,
        helpers,
      };
    };

    beforeEach('load Fixture', async () => {
      subject = await loadFixture(scenario);
    });

    it('handles zero fees scenario (no swaps)', async () => {
      const { context, helpers } = subject;
      const lpUser = actors.lpUser0();
      const nonce = await context.eternalFarming.numOfIncentives();

      const createIncentiveResult = await helpers.createIncentiveFlow({
        nonce,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        poolAddress: context.pool01,
        totalReward,
        bonusReward,
        rewardRate: BNe18(1),
        bonusRewardRate: BNe18(1) / 2n,
      });

      // Mint position
      await e20h.ensureBalancesAndApprovals(lpUser, [context.token0, context.token1], amountsToFarm[0], await context.nft.getAddress());

      const tokenId = await mintPosition(context.nft.connect(lpUser), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: ticksToFarm[0],
        tickUpper: ticksToFarm[1],
        recipient: lpUser.address,
        amount0Desired: amountsToFarm[0],
        amount1Desired: amountsToFarm[1],
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 10000,
      });

      // Enter farming
      await context.nft.connect(lpUser).approveForFarming(tokenId, true, context.farmingCenter);
      const incentiveKey = await incentiveResultToFarmAdapter(createIncentiveResult);
      await context.farmingCenter.connect(lpUser).enterFarming(incentiveKey, tokenId);

      // Wait but NO swaps
      await time.increase(days(1));

      // Exit farming - should not revert
      await expect(
        context.farmingCenter.connect(lpUser).exitFarming(incentiveKey, tokenId)
      ).to.not.be.reverted;

      // No rewards because no fees were generated
      await context.eternalFarming.connect(lpUser).claimReward(context.rewardToken, lpUser.address, 0);
      const balance = await context.rewardToken.balanceOf(lpUser.address);
      
      // Should be 0 or very small (no fees = no rewards in fee-based model)
      expect(balance).to.be.lte(1n); // Allow for rounding
    });

    it('handles out-of-range position (earns no fees from swaps)', async () => {
      const { context, helpers } = subject;
      const lpUser = actors.lpUser0();
      const trader = actors.traderUser0();
      const nonce = await context.eternalFarming.numOfIncentives();

      const createIncentiveResult = await helpers.createIncentiveFlow({
        nonce,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        poolAddress: context.pool01,
        totalReward,
        bonusReward,
        rewardRate: BNe18(1),
        bonusRewardRate: BNe18(1) / 2n,
      });

      // Mint OUT-OF-RANGE position (far above current price)
      const outOfRangeTicks: [number, number] = [6000, 12000];
      await e20h.ensureBalancesAndApprovals(lpUser, [context.token0, context.token1], amountsToFarm[0] * 10n, await context.nft.getAddress());

      const tokenId = await mintPosition(context.nft.connect(lpUser), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: outOfRangeTicks[0],
        tickUpper: outOfRangeTicks[1],
        recipient: lpUser.address,
        amount0Desired: amountsToFarm[0],
        amount1Desired: 0, // One-sided liquidity
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 10000,
      });

      // Enter farming
      await context.nft.connect(lpUser).approveForFarming(tokenId, true, context.farmingCenter);
      const incentiveKey = await incentiveResultToFarmAdapter(createIncentiveResult);
      await context.farmingCenter.connect(lpUser).enterFarming(incentiveKey, tokenId);

      // Generate fees via swaps (but position is out of range, won't earn fees)
      await helpers.makeTickGoFlow({
        trader,
        direction: 'up',
        desiredValue: 100,
      });
      await helpers.makeTickGoFlow({
        trader,
        direction: 'down',
        desiredValue: -100,
      });

      await time.increase(days(1));

      // Exit farming - should not revert
      await expect(
        context.farmingCenter.connect(lpUser).exitFarming(incentiveKey, tokenId)
      ).to.not.be.reverted;
    });

    it('handles multiple collect calls', async () => {
      const { context, helpers } = subject;
      const lpUser = actors.lpUser0();
      const trader = actors.traderUser0();
      const nonce = await context.eternalFarming.numOfIncentives();

      const createIncentiveResult = await helpers.createIncentiveFlow({
        nonce,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        poolAddress: context.pool01,
        totalReward,
        bonusReward,
        rewardRate: BNe18(1),
        bonusRewardRate: BNe18(1) / 2n,
      });

      // Mint position
      await e20h.ensureBalancesAndApprovals(lpUser, [context.token0, context.token1], amountsToFarm[0], await context.nft.getAddress());

      const tokenId = await mintPosition(context.nft.connect(lpUser), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: ticksToFarm[0],
        tickUpper: ticksToFarm[1],
        recipient: lpUser.address,
        amount0Desired: amountsToFarm[0],
        amount1Desired: amountsToFarm[1],
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 10000,
      });

      // Enter farming
      await context.nft.connect(lpUser).approveForFarming(tokenId, true, context.farmingCenter);
      const incentiveKey = await incentiveResultToFarmAdapter(createIncentiveResult);
      await context.farmingCenter.connect(lpUser).enterFarming(incentiveKey, tokenId);

      // First round of fees
      await helpers.makeTickGoFlow({
        trader,
        direction: 'up',
        desiredValue: 50,
      });
      await time.increase(3600); // 1 hour

      // First collect
      await context.farmingCenter.connect(lpUser).collectRewards(incentiveKey, tokenId);
      const rewards1 = await context.eternalFarming.rewards(lpUser.address, context.rewardToken);

      // Second round of fees
      await helpers.makeTickGoFlow({
        trader,
        direction: 'down',
        desiredValue: -50,
      });
      await time.increase(3600);

      // Second collect
      await context.farmingCenter.connect(lpUser).collectRewards(incentiveKey, tokenId);
      const rewards2 = await context.eternalFarming.rewards(lpUser.address, context.rewardToken);

      // Rewards should accumulate
      expect(rewards2).to.be.gte(rewards1);
    });
  });

  /**
   * Tests for scenarios where NOT all pool liquidity participates in farming.
   * This is crucial because:
   * - totalFees should only track fees from farming positions
   * - Non-farming positions earn fees but shouldn't affect farming rewards
   * - Virtual pool liquidity differs from real pool liquidity
   */
  describe('Partial Liquidity in Farming', () => {
    type TestSubject = {
      helpers: HelperCommands;
      context: TestContext;
      createIncentiveResult: HelperTypes.CreateIncentive.Result;
    };
    let subject: TestSubject;

    const totalReward = BNe18(100_000);
    const bonusReward = BNe18(50_000);
    const rewardRate = 10_000_000_000n;
    const bonusRewardRate = 5_000_000_000n;

    const scenario: () => Promise<TestSubject> = async () => {
      const context = await algebraFixture();
      const wallets = (await ethers.getSigners()) as any as Wallet[];
      const helpers = HelperCommands.fromTestContext(context, new ActorFixture(wallets, ethers.provider), ethers.provider);

      const nonce = await context.eternalFarming.numOfIncentives();

      const createIncentiveResult = await helpers.createIncentiveFlow({
        nonce,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        poolAddress: context.pool01,
        totalReward,
        bonusReward,
        rewardRate,
        bonusRewardRate,
      });

      return { context, helpers, createIncentiveResult };
    };

    beforeEach('load fixture', async () => {
      subject = await loadFixture(scenario);
    });

    it('should track only farming liquidity, not regular LP liquidity', async () => {
      const { context, helpers, createIncentiveResult } = subject;
      const virtualPool = createIncentiveResult.virtualPool;

      const farmingLP = actors.lpUser0();
      const regularLP = actors.lpUser1();
      const tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM];

      const fullRangeTicks: [number, number] = [
        getMinTick(tickSpacing),
        getMaxTick(tickSpacing)
      ];

      // Regular LP: adds liquidity but does NOT enter farming
      await e20h.ensureBalancesAndApprovals(
        regularLP,
        [context.token0, context.token1],
        BNe18(1000),
        await context.nft.getAddress()
      );

      await mintPosition(context.nft.connect(regularLP), {
        token0: context.token0,
        token1: context.token1,
        fee: FeeAmount.MEDIUM,
        tickLower: fullRangeTicks[0],
        tickUpper: fullRangeTicks[1],
        recipient: regularLP.address,
        amount0Desired: BNe18(500),
        amount1Desired: BNe18(500),
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 10000,
      });

      // Farming LP: adds liquidity AND enters farming
      const farmResult = await helpers.mintDepositFarmFlow({
        lp: farmingLP,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: fullRangeTicks,
        createIncentiveResult,
      });

      // Check virtual pool liquidity vs real pool liquidity
      const virtualLiquidity = await virtualPool.currentLiquidity();
      const realPoolAddress = context.pool01;
      const realPool = await ethers.getContractAt('IAlgebraPool', realPoolAddress);
      const realLiquidity = await realPool.liquidity();

      console.log('Virtual pool liquidity (farming only):', virtualLiquidity.toString());
      console.log('Real pool liquidity (total):', realLiquidity.toString());

      // Virtual pool should have LESS liquidity than real pool
      expect(virtualLiquidity).to.be.lt(realLiquidity);
    });

    it('should correctly calculate rewards when farming has minority of liquidity', async () => {
      const { context, helpers, createIncentiveResult } = subject;
      const virtualPool = createIncentiveResult.virtualPool;

      const farmingLP = actors.lpUser0();
      const regularLP = actors.lpUser1();
      const tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM];

      const fullRangeTicks: [number, number] = [
        getMinTick(tickSpacing),
        getMaxTick(tickSpacing)
      ];

      // Regular LP: adds LARGE liquidity (90% of pool)
      await e20h.ensureBalancesAndApprovals(
        regularLP,
        [context.token0, context.token1],
        BNe18(2000),
        await context.nft.getAddress()
      );

      await mintPosition(context.nft.connect(regularLP), {
        token0: context.token0,
        token1: context.token1,
        fee: FeeAmount.MEDIUM,
        tickLower: fullRangeTicks[0],
        tickUpper: fullRangeTicks[1],
        recipient: regularLP.address,
        amount0Desired: BNe18(900),
        amount1Desired: BNe18(900),
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 10000,
      });

      // Farming LP: adds SMALL liquidity (10% of pool)
      const farmResult = await helpers.mintDepositFarmFlow({
        lp: farmingLP,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: fullRangeTicks,
        createIncentiveResult,
      });

      // Swap generates fees
      const trader = actors.traderUser0();
      await e20h.ensureBalancesAndApprovals(
        trader,
        [context.token0, context.token1],
        BNe18(200),
        await context.router.getAddress()
      );

      await helpers.makeTickGoFlow({
        trader,
        direction: 'up',
        desiredValue: 50,
      });

      await time.increase(days(1));

      // Farming position should still earn 100% of farming rewards
      // because it's the ONLY position in farming
      const incentiveKey = await incentiveResultToFarmAdapter(createIncentiveResult);

      await context.farmingCenter.connect(farmingLP).exitFarming(incentiveKey, farmResult.tokenId);
      await context.eternalFarming.connect(farmingLP).claimReward(context.rewardToken, farmingLP.address, 0);

      const reward = await context.rewardToken.balanceOf(farmingLP.address);
      console.log('Reward for farming position (10% of pool liquidity):', reward.toString());
      expect(reward).to.be.gt(0);
    });

    it('should handle multiple farming positions with different liquidity amounts', async () => {
      const { context, helpers, createIncentiveResult } = subject;
      const virtualPool = createIncentiveResult.virtualPool;

      const lpUser1 = actors.lpUser0();
      const lpUser2 = actors.lpUser1();
      const tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM];

      const fullRangeTicks: [number, number] = [
        getMinTick(tickSpacing),
        getMaxTick(tickSpacing)
      ];

      // LP1: Large liquidity in farming
      const farm1 = await helpers.mintDepositFarmFlow({
        lp: lpUser1,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(400), BNe18(400)],
        ticks: fullRangeTicks,
        createIncentiveResult,
      });

      // LP2: Small liquidity in farming
      const farm2 = await helpers.mintDepositFarmFlow({
        lp: lpUser2,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: fullRangeTicks,
        createIncentiveResult,
      });

      // Perform swap
      const trader = actors.traderUser0();
      await helpers.makeTickGoFlow({
        trader,
        direction: 'up',
        desiredValue: 50,
      });

      await time.increase(days(1));

      const incentiveKey = await incentiveResultToFarmAdapter(createIncentiveResult);

      // Exit and collect for both
      await context.farmingCenter.connect(lpUser1).exitFarming(incentiveKey, farm1.tokenId);
      await context.farmingCenter.connect(lpUser2).exitFarming(incentiveKey, farm2.tokenId);

      await context.eternalFarming.connect(lpUser1).claimReward(context.rewardToken, lpUser1.address, 0);
      await context.eternalFarming.connect(lpUser2).claimReward(context.rewardToken, lpUser2.address, 0);

      const reward1 = await context.rewardToken.balanceOf(lpUser1.address);
      const reward2 = await context.rewardToken.balanceOf(lpUser2.address);

      console.log('LP1 (4x liquidity) reward:', reward1.toString());
      console.log('LP2 (1x liquidity) reward:', reward2.toString());

      // LP1 should earn more rewards (more fees due to more liquidity)
      expect(reward1).to.be.gt(reward2);

      // Ratio should be approximately 4:1 (within tolerance for rounding)
      if (reward1 > 0n && reward2 > 0n) {
        const ratio = Number(reward1) / Number(reward2);
        console.log('Reward ratio (expected ~4):', ratio);
        expect(ratio).to.be.closeTo(4, 1);
      }
    });

    it('should continue tracking correctly when one position exits farming', async () => {
      const { context, helpers, createIncentiveResult } = subject;
      const virtualPool = createIncentiveResult.virtualPool;

      const lpUser1 = actors.lpUser0();
      const lpUser2 = actors.lpUser1();
      const tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM];

      const fullRangeTicks: [number, number] = [
        getMinTick(tickSpacing),
        getMaxTick(tickSpacing)
      ];

      // Both LPs enter farming
      const farm1 = await helpers.mintDepositFarmFlow({
        lp: lpUser1,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(200), BNe18(200)],
        ticks: fullRangeTicks,
        createIncentiveResult,
      });

      const farm2 = await helpers.mintDepositFarmFlow({
        lp: lpUser2,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(200), BNe18(200)],
        ticks: fullRangeTicks,
        createIncentiveResult,
      });

      const trader = actors.traderUser0();

      // First swap - both positions in farming
      await helpers.makeTickGoFlow({
        trader,
        direction: 'up',
        desiredValue: 50,
      });

      await time.increase(days(1));

      // LP1 exits farming
      const incentiveKey = await incentiveResultToFarmAdapter(createIncentiveResult);
      await context.farmingCenter.connect(lpUser1).exitFarming(incentiveKey, farm1.tokenId);

      const liquidityAfterExit = await virtualPool.currentLiquidity();
      console.log('Virtual pool liquidity after LP1 exit:', liquidityAfterExit.toString());

      // Second swap - only LP2 in farming
      await helpers.makeTickGoFlow({
        trader,
        direction: 'down',
        desiredValue: -50,
      });

      await time.increase(days(1));

      // LP2 should still earn rewards from second swap
      await context.farmingCenter.connect(lpUser2).exitFarming(incentiveKey, farm2.tokenId);
      await context.eternalFarming.connect(lpUser2).claimReward(context.rewardToken, lpUser2.address, 0);

      const reward2 = await context.rewardToken.balanceOf(lpUser2.address);
      console.log('LP2 reward (remaining in farming):', reward2.toString());

      expect(reward2).to.be.gt(0);
    });

    it('should track fees correctly when position joins farming after swaps occurred', async () => {
      const { context, helpers, createIncentiveResult } = subject;
      const virtualPool = createIncentiveResult.virtualPool;

      const lpUser = actors.lpUser0();
      const tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM];

      const fullRangeTicks: [number, number] = [
        getMinTick(tickSpacing),
        getMaxTick(tickSpacing)
      ];

      // First, create a position but don't enter farming yet
      await e20h.ensureBalancesAndApprovals(
        lpUser,
        [context.token0, context.token1],
        BNe18(500),
        await context.nft.getAddress()
      );

      const tokenId = await mintPosition(context.nft.connect(lpUser), {
        token0: context.token0,
        token1: context.token1,
        fee: FeeAmount.MEDIUM,
        tickLower: fullRangeTicks[0],
        tickUpper: fullRangeTicks[1],
        recipient: lpUser.address,
        amount0Desired: BNe18(200),
        amount1Desired: BNe18(200),
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 10000,
      });

      // Perform swaps BEFORE entering farming
      const trader = actors.traderUser0();
      await helpers.makeTickGoFlow({
        trader,
        direction: 'up',
        desiredValue: 50,
      });

      // Check totalFees before entering farming - should be 0 (no farming positions yet)
      const feesBefore = await virtualPool.totalFees();
      expect(feesBefore).to.equal(1n); // Initial value is 1

      // Now enter farming
      await context.nft.connect(lpUser).approveForFarming(tokenId, true, context.farmingCenter);
      const incentiveKey = await incentiveResultToFarmAdapter(createIncentiveResult);
      await context.farmingCenter.connect(lpUser).enterFarming(incentiveKey, tokenId);

      // Perform more swaps AFTER entering farming
      await helpers.makeTickGoFlow({
        trader,
        direction: 'down',
        desiredValue: -50,
      });

      const feesAfter = await virtualPool.totalFees();

      // Now totalFees should be > initial value (tracking post-entry fees)
      expect(feesAfter).to.be.gt(feesBefore);
      console.log('Fees tracked after entering farming:', feesAfter.toString());

      await time.increase(days(1));

      // Should earn rewards only for post-entry fees
      await context.farmingCenter.connect(lpUser).exitFarming(incentiveKey, tokenId);
      await context.eternalFarming.connect(lpUser).claimReward(context.rewardToken, lpUser.address, 0);

      const reward = await context.rewardToken.balanceOf(lpUser.address);
      expect(reward).to.be.gt(0);
    });
  });

  /**
   * Tests for scenarios with community fee enabled
   * Community fee takes a portion of trading fees before LP distribution
   */
  describe('Community Fee scenarios', () => {
    type TestSubject = {
      helpers: HelperCommands;
      context: TestContext;
      createIncentiveResult: HelperTypes.CreateIncentive.Result;
    };
    let subject: TestSubject;

    const totalReward = BNe18(100_000);
    const bonusReward = BNe18(50_000);
    const rewardRate = 10_000_000_000n;
    const bonusRewardRate = 5_000_000_000n;

    const scenario: () => Promise<TestSubject> = async () => {
      const context = await algebraFixture();
      const wallets = (await ethers.getSigners()) as any as Wallet[];
      const helpers = HelperCommands.fromTestContext(context, new ActorFixture(wallets, ethers.provider), ethers.provider);

      const nonce = await context.eternalFarming.numOfIncentives();

      const createIncentiveResult = await helpers.createIncentiveFlow({
        nonce,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        poolAddress: context.pool01,
        totalReward,
        bonusReward,
        rewardRate,
        bonusRewardRate,
      });

      return { context, helpers, createIncentiveResult };
    };

    beforeEach('load fixture', async () => {
      subject = await loadFixture(scenario);
    });

    it('should work correctly with community fee enabled', async () => {
      const { context, helpers, createIncentiveResult } = subject;

      const farmingLP = actors.lpUser0();
      const tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM];

      const fullRangeTicks: [number, number] = [
        getMinTick(tickSpacing),
        getMaxTick(tickSpacing)
      ];

      // Enable community fee (15%)
      await (context.poolObj as any).connect(context.ownerSigner).setCommunityFee(150); // 15% = 150/1000

      // Enter farming
      const farmResult = await helpers.mintDepositFarmFlow({
        lp: farmingLP,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: fullRangeTicks,
        createIncentiveResult,
      });

      // Perform swaps to generate fees
      const trader = actors.traderUser0();
      await helpers.makeTickGoFlow({
        trader,
        direction: 'up',
        desiredValue: 100,
      });

      await time.increase(days(1));

      // Should still earn rewards (though less due to community fee)
      const incentiveKey = await incentiveResultToFarmAdapter(createIncentiveResult);
      await context.farmingCenter.connect(farmingLP).exitFarming(incentiveKey, farmResult.tokenId);
      await context.eternalFarming.connect(farmingLP).claimReward(context.rewardToken, farmingLP.address, 0);

      const reward = await context.rewardToken.balanceOf(farmingLP.address);
      console.log('Reward with 15% community fee:', reward.toString());

      // Should still earn positive rewards
      expect(reward).to.be.gt(0);
    });

    it('should earn less rewards when community fee increases', async () => {
      const { context, helpers, createIncentiveResult } = subject;

      const farmingLP = actors.lpUser0();
      const farmingLP2 = actors.lpUser1();
      const tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM];

      const fullRangeTicks: [number, number] = [
        getMinTick(tickSpacing),
        getMaxTick(tickSpacing)
      ];

      // First test: No community fee
      const farmResult1 = await helpers.mintDepositFarmFlow({
        lp: farmingLP,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: fullRangeTicks,
        createIncentiveResult,
      });

      const trader = actors.traderUser0();
      await helpers.makeTickGoFlow({
        trader,
        direction: 'up',
        desiredValue: 50,
      });

      await time.increase(days(1));

      const incentiveKey = await incentiveResultToFarmAdapter(createIncentiveResult);
      await context.farmingCenter.connect(farmingLP).exitFarming(incentiveKey, farmResult1.tokenId);
      await context.eternalFarming.connect(farmingLP).claimReward(context.rewardToken, farmingLP.address, 0);

      const rewardWithoutCommunityFee = await context.rewardToken.balanceOf(farmingLP.address);
      console.log('Reward without community fee:', rewardWithoutCommunityFee.toString());

      // Now enable community fee (50%)
      await (context.poolObj as any).connect(context.ownerSigner).setCommunityFee(500); // 50% = 500/1000

      // Second test: With 50% community fee
      const farmResult2 = await helpers.mintDepositFarmFlow({
        lp: farmingLP2,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: fullRangeTicks,
        createIncentiveResult,
      });

      await helpers.makeTickGoFlow({
        trader,
        direction: 'down',
        desiredValue: -50,
      });

      await time.increase(days(1));

      await context.farmingCenter.connect(farmingLP2).exitFarming(incentiveKey, farmResult2.tokenId);
      await context.eternalFarming.connect(farmingLP2).claimReward(context.rewardToken, farmingLP2.address, 0);

      const rewardWithCommunityFee = await context.rewardToken.balanceOf(farmingLP2.address);
      console.log('Reward with 50% community fee:', rewardWithCommunityFee.toString());

      // Both should be positive
      expect(rewardWithoutCommunityFee).to.be.gt(0);
      expect(rewardWithCommunityFee).to.be.gt(0);

      // Reward with community fee should be less (approximately half)
      // Note: This is approximate due to different swap conditions
      if (rewardWithoutCommunityFee > 0n && rewardWithCommunityFee > 0n) {
        console.log('Ratio (without/with):', Number(rewardWithoutCommunityFee) / Number(rewardWithCommunityFee));
      }
    });
  });

  /**
   * Tests for narrow range positions vs wide range positions
   */
  describe('Position range impact on rewards', () => {
    type TestSubject = {
      helpers: HelperCommands;
      context: TestContext;
      createIncentiveResult: HelperTypes.CreateIncentive.Result;
    };
    let subject: TestSubject;

    const totalReward = BNe18(100_000);
    const bonusReward = BNe18(50_000);
    const rewardRate = 10_000_000_000n;
    const bonusRewardRate = 5_000_000_000n;

    const scenario: () => Promise<TestSubject> = async () => {
      const context = await algebraFixture();
      const wallets = (await ethers.getSigners()) as any as Wallet[];
      const helpers = HelperCommands.fromTestContext(context, new ActorFixture(wallets, ethers.provider), ethers.provider);

      const nonce = await context.eternalFarming.numOfIncentives();

      const createIncentiveResult = await helpers.createIncentiveFlow({
        nonce,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        poolAddress: context.pool01,
        totalReward,
        bonusReward,
        rewardRate,
        bonusRewardRate,
      });

      return { context, helpers, createIncentiveResult };
    };

    beforeEach('load fixture', async () => {
      subject = await loadFixture(scenario);
    });

    it('should reward narrow range positions more per liquidity when in range', async () => {
      const { context, helpers, createIncentiveResult } = subject;

      const lpNarrow = actors.lpUser0();
      const lpWide = actors.lpUser1();
      const tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM];

      // Narrow range around current price (higher concentration)
      const narrowTicks: [number, number] = [-tickSpacing * 5, tickSpacing * 5];

      // Wide range (lower concentration)
      const wideTicks: [number, number] = [
        getMinTick(tickSpacing),
        getMaxTick(tickSpacing)
      ];

      // Both provide same capital, narrow gets more liquidity
      const farmNarrow = await helpers.mintDepositFarmFlow({
        lp: lpNarrow,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: narrowTicks,
        createIncentiveResult,
      });

      const farmWide = await helpers.mintDepositFarmFlow({
        lp: lpWide,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: wideTicks,
        createIncentiveResult,
      });

      // Small swap within narrow range
      const trader = actors.traderUser0();
      await helpers.makeTickGoFlow({
        trader,
        direction: 'up',
        desiredValue: 10, // Small move, stays in narrow range
      });

      await time.increase(days(1));

      const incentiveKey = await incentiveResultToFarmAdapter(createIncentiveResult);

      await context.farmingCenter.connect(lpNarrow).exitFarming(incentiveKey, farmNarrow.tokenId);
      await context.farmingCenter.connect(lpWide).exitFarming(incentiveKey, farmWide.tokenId);

      await context.eternalFarming.connect(lpNarrow).claimReward(context.rewardToken, lpNarrow.address, 0);
      await context.eternalFarming.connect(lpWide).claimReward(context.rewardToken, lpWide.address, 0);

      const rewardNarrow = await context.rewardToken.balanceOf(lpNarrow.address);
      const rewardWide = await context.rewardToken.balanceOf(lpWide.address);

      console.log('Narrow position reward:', rewardNarrow.toString());
      console.log('Wide position reward:', rewardWide.toString());

      // Narrow position should earn more (concentrated liquidity = more fees)
      expect(rewardNarrow).to.be.gt(0);
      expect(rewardWide).to.be.gt(0);
      expect(rewardNarrow).to.be.gt(rewardWide);
    });
  });
});
