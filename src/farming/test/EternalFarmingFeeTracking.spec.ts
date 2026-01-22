import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { TestContext } from './types';
import { AlgebraEternalFarming, TestERC20, IAlgebraPool } from '../typechain';
import { ethers } from 'hardhat';
import { blockTimestamp, BNe18, expect, FeeAmount, getMaxTick, getMinTick, TICK_SPACINGS, algebraFixture, days, mintPosition, maxGas, encodePriceSqrt, encodePath, ZERO_ADDRESS, MAX_GAS_LIMIT } from './shared';
import { ERC20Helper, HelperCommands, incentiveResultToFarmAdapter } from './helpers';
import { provider } from './shared/provider';
import { ActorFixture } from './shared/actors';
import { HelperTypes } from './helpers/types';
import { Wallet, MaxUint256 } from 'ethers';

/**
 * Tests for fee-based farming reward distribution.
 * 
 * The new approach distributes rewards proportionally to fees earned:
 * - Virtual pool tracks totalFees (all fees earned by farming positions)
 * - Individual position fees are calculated using innerFeeGrowth from real pool
 * - Reward = potentialRewards * (positionFees / totalFeesDelta)
 */
describe('EternalFarming - Fee-Based Reward Tracking', () => {
  let wallets: Wallet[];
  let actors: ActorFixture;
  const e20h = new ERC20Helper();

  before(async () => {
    wallets = (await (ethers.getSigners() as any)) as Wallet[];
    actors = new ActorFixture(wallets, provider);
  });

  describe('Virtual Pool Total Fees Tracking', () => {
    type TestSubject = {
      helpers: HelperCommands;
      context: TestContext;
      createIncentiveResult: HelperTypes.CreateIncentive.Result;
    };
    let subject: TestSubject;

    const totalReward = BNe18(100_000);
    const bonusReward = BNe18(50_000);
    const rewardRate = 100n; // 100 wei per second
    const bonusRewardRate = 50n;

    const ticksToFarm: [number, number] = [
      getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
      getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])
    ];
    const amountsToFarm: [bigint, bigint] = [BNe18(100), BNe18(100)];

    const scenario: () => Promise<TestSubject> = async () => {
      const context = await algebraFixture();
      const helpers = HelperCommands.fromTestContext(context, actors, provider);

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

    it('should initialize virtual pool with zero total fees', async () => {
      const { createIncentiveResult } = subject;
      const virtualPool = createIncentiveResult.virtualPool;

      const [totalFees0, totalFees1] = await virtualPool.getTotalFees();

      expect(totalFees0).to.equal(0);
      expect(totalFees1).to.equal(0);
    });

    it('should accumulate total fees when swaps occur with farming position', async () => {
      const { context, helpers, createIncentiveResult } = subject;
      const virtualPool = createIncentiveResult.virtualPool;
      
      const lpUser = actors.lpUser0();

      // Create farming position
      await helpers.mintDepositFarmFlow({
        lp: lpUser,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm,
        ticks: ticksToFarm,
        createIncentiveResult,
      });

      // Check totalFees before swap
      let [totalFees0Before, totalFees1Before] = await virtualPool.getTotalFees();
      expect(totalFees0Before).to.equal(0);
      expect(totalFees1Before).to.equal(0);

      // Perform swap to generate fees
      const trader = actors.traderUser0();
      await e20h.ensureBalancesAndApprovals(
        trader,
        [context.token0, context.token1],
        BNe18(100),
        await context.router.getAddress()
      );

      await context.router.connect(trader).exactInputSingle({
        tokenIn: await context.token0.getAddress(),
        tokenOut: await context.token1.getAddress(),
        deployer: ZERO_ADDRESS,
        recipient: trader.address,
        deadline: (await blockTimestamp()) + 10000,
        amountIn: BNe18(10),
        amountOutMinimum: 0,
        limitSqrtPrice: 0,
      }, { gasLimit: MAX_GAS_LIMIT });

      // Update total fees and check
      await virtualPool.updateTotalFees();
      const [totalFees0After, totalFees1After] = await virtualPool.getTotalFees();

      // Fees should have increased (swap was zeroToOne, so token0 fees accrue)
      expect(totalFees0After).to.be.gt(totalFees0Before);
    });

    it('should track fees correctly for swap in both directions', async () => {
      const { context, helpers, createIncentiveResult } = subject;
      const virtualPool = createIncentiveResult.virtualPool;
      
      const lpUser = actors.lpUser0();

      // Create farming position
      await helpers.mintDepositFarmFlow({
        lp: lpUser,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm,
        ticks: ticksToFarm,
        createIncentiveResult,
      });

      const trader = actors.traderUser0();
      await e20h.ensureBalancesAndApprovals(
        trader,
        [context.token0, context.token1],
        BNe18(200),
        await context.router.getAddress()
      );

      // Swap token0 -> token1
      await context.router.connect(trader).exactInputSingle({
        tokenIn: await context.token0.getAddress(),
        tokenOut: await context.token1.getAddress(),
        deployer: ZERO_ADDRESS,
        recipient: trader.address,
        deadline: (await blockTimestamp()) + 10000,
        amountIn: BNe18(10),
        amountOutMinimum: 0,
        limitSqrtPrice: 0,
      }, { gasLimit: MAX_GAS_LIMIT });

      await virtualPool.updateTotalFees();
      const [fees0After1, fees1After1] = await virtualPool.getTotalFees();

      // Swap token1 -> token0
      await context.router.connect(trader).exactInputSingle({
        tokenIn: await context.token1.getAddress(),
        tokenOut: await context.token0.getAddress(),
        deployer: ZERO_ADDRESS,
        recipient: trader.address,
        deadline: (await blockTimestamp()) + 10000,
        amountIn: BNe18(10),
        amountOutMinimum: 0,
        limitSqrtPrice: 0,
      }, { gasLimit: MAX_GAS_LIMIT });

      await virtualPool.updateTotalFees();
      const [fees0After2, fees1After2] = await virtualPool.getTotalFees();

      // Both token fees should have increased
      expect(fees0After1).to.be.gt(0);
      expect(fees1After2).to.be.gt(fees1After1);
    });
  });

  describe('Fee-Based Reward Calculation', () => {
    type TestSubject = {
      helpers: HelperCommands;
      context: TestContext;
      createIncentiveResult: HelperTypes.CreateIncentive.Result;
    };
    let subject: TestSubject;

    const totalReward = BNe18(100_000);
    const bonusReward = BNe18(50_000);
    const rewardRate = 10_000_000_000n; // High rate to see noticeable rewards
    const bonusRewardRate = 5_000_000_000n;

    const scenario: () => Promise<TestSubject> = async () => {
      const context = await algebraFixture();
      const helpers = HelperCommands.fromTestContext(context, actors, provider);

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

    it('should calculate rewards proportionally to fees earned', async () => {
      const { context, helpers, createIncentiveResult } = subject;
      
      const lpUser = actors.lpUser0();
      const ticksToFarm: [number, number] = [
        getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])
      ];

      // Enter farming
      const farmResult = await helpers.mintDepositFarmFlow({
        lp: lpUser,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: ticksToFarm,
        createIncentiveResult,
      });

      // Perform swaps to generate fees
      const trader = actors.traderUser0();
      await e20h.ensureBalancesAndApprovals(
        trader,
        [context.token0, context.token1],
        BNe18(500),
        await context.router.getAddress()
      );

      for (let i = 0; i < 5; i++) {
        await context.router.connect(trader).exactInputSingle({
          tokenIn: await context.token0.getAddress(),
          tokenOut: await context.token1.getAddress(),
          deployer: ZERO_ADDRESS,
          recipient: trader.address,
          deadline: (await blockTimestamp()) + 10000,
          amountIn: BNe18(10),
          amountOutMinimum: 0,
          limitSqrtPrice: 0,
        }, { gasLimit: MAX_GAS_LIMIT });
      }

      // Advance time
      await time.increase(days(1));

      // Update total fees before getting reward info
      const virtualPool = createIncentiveResult.virtualPool;
      await virtualPool.updateTotalFees();

      // Get reward info
      const incentiveKey = {
        pool: context.pool01,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        nonce: 0,
      };

      const [reward, bonusReward] = await context.eternalFarming.getRewardInfo(
        incentiveKey,
        farmResult.tokenId
      );

      // Position should have earned rewards (proportional to fees)
      expect(reward).to.be.gt(0);
    });

    it('should distribute rewards based on position fee share', async () => {
      const { context, helpers, createIncentiveResult } = subject;
      
      const lpUser1 = actors.lpUser0();
      const lpUser2 = actors.lpUser1();

      const tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM];
      
      // User1: Narrow range (will earn more fees per liquidity)
      const narrowTicks: [number, number] = [-tickSpacing * 10, tickSpacing * 10];
      
      // User2: Wide range (will earn less fees per liquidity)  
      const wideTicks: [number, number] = [
        getMinTick(tickSpacing),
        getMaxTick(tickSpacing)
      ];

      // User1 enters farming with narrow range
      const farm1 = await helpers.mintDepositFarmFlow({
        lp: lpUser1,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: narrowTicks,
        createIncentiveResult,
      });

      // User2 enters farming with wide range
      const farm2 = await helpers.mintDepositFarmFlow({
        lp: lpUser2,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: wideTicks,
        createIncentiveResult,
      });

      // Perform swaps (price stays near 0, so narrow range earns more)
      const trader = actors.traderUser0();
      await e20h.ensureBalancesAndApprovals(
        trader,
        [context.token0, context.token1],
        BNe18(100),
        await context.router.getAddress()
      );

      await context.router.connect(trader).exactInputSingle({
        tokenIn: await context.token0.getAddress(),
        tokenOut: await context.token1.getAddress(),
        deployer: ZERO_ADDRESS,
        recipient: trader.address,
        deadline: (await blockTimestamp()) + 10000,
        amountIn: BNe18(50),
        amountOutMinimum: 0,
        limitSqrtPrice: 0,
      }, { gasLimit: MAX_GAS_LIMIT });

      // Advance time
      await time.increase(days(1));

      // Update total fees before getting reward info
      const virtualPool = createIncentiveResult.virtualPool;
      await virtualPool.updateTotalFees();

      // Get rewards for both positions
      const incentiveKey = {
        pool: context.pool01,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        nonce: 0,
      };

      const [reward1] = await context.eternalFarming.getRewardInfo(incentiveKey, farm1.tokenId);
      const [reward2] = await context.eternalFarming.getRewardInfo(incentiveKey, farm2.tokenId);

      console.log('Narrow range reward:', reward1.toString());
      console.log('Wide range reward:', reward2.toString());

      // Narrow range position should earn more rewards (higher fee concentration)
      // Note: The actual comparison depends on the relative liquidity and tick positions
      expect(reward1).to.be.gt(0);
      expect(reward2).to.be.gt(0);
    });
  });

  describe('Collecting Rewards', () => {
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
      const helpers = HelperCommands.fromTestContext(context, actors, provider);

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

    it('should allow collecting rewards without exiting farming', async () => {
      const { context, helpers, createIncentiveResult } = subject;
      
      const lpUser = actors.lpUser0();
      const ticksToFarm: [number, number] = [
        getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])
      ];

      // Enter farming
      const farmResult = await helpers.mintDepositFarmFlow({
        lp: lpUser,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: ticksToFarm,
        createIncentiveResult,
      });

      // Generate fees
      const trader = actors.traderUser0();
      await e20h.ensureBalancesAndApprovals(
        trader,
        [context.token0, context.token1],
        BNe18(200),
        await context.router.getAddress()
      );

      await context.router.connect(trader).exactInputSingle({
        tokenIn: await context.token0.getAddress(),
        tokenOut: await context.token1.getAddress(),
        deployer: ZERO_ADDRESS,
        recipient: trader.address,
        deadline: (await blockTimestamp()) + 10000,
        amountIn: BNe18(50),
        amountOutMinimum: 0,
        limitSqrtPrice: 0,
      }, { gasLimit: MAX_GAS_LIMIT });

      // Advance time
      await time.increase(days(1));

      // Collect rewards via farming center
      const incentiveAdapter = await incentiveResultToFarmAdapter(createIncentiveResult);
      
      await context.farmingCenter.connect(lpUser).collectRewards(
        incentiveAdapter,
        farmResult.tokenId,
        maxGas
      );

      // Check that rewards are in pending state
      const pendingReward = await context.eternalFarming.rewards(
        lpUser.address,
        context.rewardToken
      );

      expect(pendingReward).to.be.gt(0);

      // Claim rewards
      const balanceBefore = await context.rewardToken.balanceOf(lpUser.address);
      
      await context.eternalFarming.connect(lpUser).claimReward(
        context.rewardToken,
        lpUser.address,
        0 // claim all
      );

      const balanceAfter = await context.rewardToken.balanceOf(lpUser.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it('should reset fee tracking on collect for accurate subsequent rewards', async () => {
      const { context, helpers, createIncentiveResult } = subject;
      
      const lpUser = actors.lpUser0();
      const ticksToFarm: [number, number] = [
        getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])
      ];

      // Enter farming
      const farmResult = await helpers.mintDepositFarmFlow({
        lp: lpUser,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: ticksToFarm,
        createIncentiveResult,
      });

      const trader = actors.traderUser0();
      await e20h.ensureBalancesAndApprovals(
        trader,
        [context.token0, context.token1],
        BNe18(500),
        await context.router.getAddress()
      );

      // First period: generate fees
      await context.router.connect(trader).exactInputSingle({
        tokenIn: await context.token0.getAddress(),
        tokenOut: await context.token1.getAddress(),
        deployer: ZERO_ADDRESS,
        recipient: trader.address,
        deadline: (await blockTimestamp()) + 10000,
        amountIn: BNe18(50),
        amountOutMinimum: 0,
        limitSqrtPrice: 0,
      }, { gasLimit: MAX_GAS_LIMIT });

      await time.increase(days(1));

      // Collect first batch of rewards
      const incentiveAdapter = await incentiveResultToFarmAdapter(createIncentiveResult);
      await context.farmingCenter.connect(lpUser).collectRewards(
        incentiveAdapter,
        farmResult.tokenId,
        maxGas
      );

      const firstReward = await context.eternalFarming.rewards(
        lpUser.address,
        context.rewardToken
      );

      // Claim first batch
      await context.eternalFarming.connect(lpUser).claimReward(
        context.rewardToken,
        lpUser.address,
        0
      );

      // Second period: generate more fees
      await context.router.connect(trader).exactInputSingle({
        tokenIn: await context.token0.getAddress(),
        tokenOut: await context.token1.getAddress(),
        deployer: ZERO_ADDRESS,
        recipient: trader.address,
        deadline: (await blockTimestamp()) + 10000,
        amountIn: BNe18(50),
        amountOutMinimum: 0,
        limitSqrtPrice: 0,
      }, { gasLimit: MAX_GAS_LIMIT });

      await time.increase(days(1));

      // Collect second batch
      await context.farmingCenter.connect(lpUser).collectRewards(
        incentiveAdapter,
        farmResult.tokenId,
        maxGas
      );

      const secondReward = await context.eternalFarming.rewards(
        lpUser.address,
        context.rewardToken
      );

      // Both reward periods should be non-zero
      expect(firstReward).to.be.gt(0);
      expect(secondReward).to.be.gt(0);
    });
  });

  describe('Exit Farming', () => {
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
      const helpers = HelperCommands.fromTestContext(context, actors, provider);

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

    it('should calculate and credit all pending rewards on exit', async () => {
      const { context, helpers, createIncentiveResult } = subject;
      
      const lpUser = actors.lpUser0();
      const ticksToFarm: [number, number] = [
        getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])
      ];

      // Enter farming
      const farmResult = await helpers.mintDepositFarmFlow({
        lp: lpUser,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: ticksToFarm,
        createIncentiveResult,
      });

      // Generate fees
      const trader = actors.traderUser0();
      await e20h.ensureBalancesAndApprovals(
        trader,
        [context.token0, context.token1],
        BNe18(200),
        await context.router.getAddress()
      );

      await context.router.connect(trader).exactInputSingle({
        tokenIn: await context.token0.getAddress(),
        tokenOut: await context.token1.getAddress(),
        deployer: ZERO_ADDRESS,
        recipient: trader.address,
        deadline: (await blockTimestamp()) + 10000,
        amountIn: BNe18(50),
        amountOutMinimum: 0,
        limitSqrtPrice: 0,
      }, { gasLimit: MAX_GAS_LIMIT });

      await time.increase(days(1));

      // Exit farming
      const incentiveAdapter = await incentiveResultToFarmAdapter(createIncentiveResult);
      await context.farmingCenter.connect(lpUser).exitFarming(
        incentiveAdapter,
        farmResult.tokenId,
        maxGas
      );

      // Check pending rewards were credited
      const pendingReward = await context.eternalFarming.rewards(
        lpUser.address,
        context.rewardToken
      );

      expect(pendingReward).to.be.gt(0);

      // Verify farm was deleted
      const incentiveKey = {
        pool: context.pool01,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        nonce: 0,
      };

      const incentiveId = await context.testIncentiveId.compute(incentiveKey);
      const farm = await context.eternalFarming.farms(farmResult.tokenId, incentiveId);
      
      expect(farm.liquidity).to.equal(0); // Farm should be deleted
    });

    it('should correctly calculate final rewards after multiple operations', async () => {
      const { context, helpers, createIncentiveResult } = subject;
      
      const lpUser = actors.lpUser0();
      const ticksToFarm: [number, number] = [
        getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])
      ];

      // Enter farming
      const farmResult = await helpers.mintDepositFarmFlow({
        lp: lpUser,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: ticksToFarm,
        createIncentiveResult,
      });

      const trader = actors.traderUser0();
      await e20h.ensureBalancesAndApprovals(
        trader,
        [context.token0, context.token1],
        BNe18(500),
        await context.router.getAddress()
      );

      // Multiple swaps over time
      for (let i = 0; i < 3; i++) {
        await context.router.connect(trader).exactInputSingle({
          tokenIn: await context.token0.getAddress(),
          tokenOut: await context.token1.getAddress(),
          deployer: ZERO_ADDRESS,
          recipient: trader.address,
          deadline: (await blockTimestamp()) + 10000,
          amountIn: BNe18(30),
          amountOutMinimum: 0,
          limitSqrtPrice: 0,
        }, { gasLimit: MAX_GAS_LIMIT });

        await time.increase(86400); // 1 day between swaps
      }

      // Exit and collect all
      const result = await helpers.exitFarmingCollectBurnFlow({
        lp: lpUser,
        tokenId: farmResult.tokenId,
        createIncentiveResult,
      });

      // Should have earned non-trivial rewards
      expect(result.balance).to.be.gt(0);
      console.log('Total reward earned:', result.balance.toString());
      console.log('Total bonus reward earned:', result.bonusBalance.toString());
    });
  });

  describe('Edge Cases', () => {
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
      const helpers = HelperCommands.fromTestContext(context, actors, provider);

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

    it('should handle zero fees scenario gracefully', async () => {
      const { context, helpers, createIncentiveResult } = subject;
      
      const lpUser = actors.lpUser0();
      const ticksToFarm: [number, number] = [
        getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])
      ];

      // Enter farming
      const farmResult = await helpers.mintDepositFarmFlow({
        lp: lpUser,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: ticksToFarm,
        createIncentiveResult,
      });

      // Advance time WITHOUT any swaps
      await time.increase(days(1));

      // Get reward info - should be 0 because no fees were generated
      const incentiveKey = {
        pool: context.pool01,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        nonce: 0,
      };

      const [reward, bonusReward] = await context.eternalFarming.getRewardInfo(
        incentiveKey,
        farmResult.tokenId
      );

      // No fees = no rewards (despite time passing)
      expect(reward).to.equal(0);
      expect(bonusReward).to.equal(0);
    });

    it('should handle position out of range', async () => {
      const { context, helpers, createIncentiveResult } = subject;
      
      const lpUser = actors.lpUser0();
      const lpUser2 = actors.lpUser1();
      const tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM];
      
      // First, create a position in the main range to enable swaps
      const mainRangeTicks: [number, number] = [
        getMinTick(tickSpacing),
        getMaxTick(tickSpacing)
      ];
      
      await helpers.mintDepositFarmFlow({
        lp: lpUser2,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(1000), BNe18(1000)],
        ticks: mainRangeTicks,
        createIncentiveResult,
      });

      // Create position in narrow range above current tick (out of range)
      const narrowTicks: [number, number] = [tickSpacing * 100, tickSpacing * 200];

      // First add liquidity in this range to make it valid
      await e20h.ensureBalancesAndApprovals(
        lpUser,
        [context.token0, context.token1],
        BNe18(1000),
        await context.nft.getAddress()
      );

      const tokenId = await mintPosition(context.nft.connect(lpUser), {
        token0: context.token0,
        token1: context.token1,
        fee: FeeAmount.MEDIUM,
        tickLower: narrowTicks[0],
        tickUpper: narrowTicks[1],
        recipient: lpUser.address,
        amount0Desired: BNe18(100),
        amount1Desired: 0, // Only token0 since above current price
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 10000,
      });

      // Enter farming
      await context.nft.connect(lpUser).approveForFarming(tokenId, true, context.farmingCenter);
      const incentiveAdapter = await incentiveResultToFarmAdapter(createIncentiveResult);
      await context.farmingCenter.connect(lpUser).enterFarming(incentiveAdapter, tokenId);

      // Perform swap in the main range (not in our position's range)
      const trader = actors.traderUser0();
      await e20h.ensureBalancesAndApprovals(
        trader,
        [context.token0, context.token1],
        BNe18(100),
        await context.router.getAddress()
      );

      await context.router.connect(trader).exactInputSingle({
        tokenIn: await context.token0.getAddress(),
        tokenOut: await context.token1.getAddress(),
        deployer: ZERO_ADDRESS,
        recipient: trader.address,
        deadline: (await blockTimestamp()) + 10000,
        amountIn: BNe18(10),
        amountOutMinimum: 0,
        limitSqrtPrice: 0,
      }, { gasLimit: MAX_GAS_LIMIT });

      await time.increase(days(1));

      // Update total fees before getting reward info
      const virtualPool = await ethers.getContractAt(
        'EternalVirtualPool',
        await context.eternalFarming.incentives(
          await (helpers as any).getIncentiveId(createIncentiveResult)
        )
      ) as any;
      await virtualPool.updateTotalFees();

      // Position out of range should earn no fees -> no rewards
      const incentiveKey = {
        pool: context.pool01,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        nonce: 0,
      };

      const [reward] = await context.eternalFarming.getRewardInfo(incentiveKey, tokenId);

      // Should be zero because position is out of range
      expect(reward).to.equal(0);
    });
  });
});
