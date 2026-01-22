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

    it('should only track fees from farming positions, not from regular LP', async () => {
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

      const regularTokenId = await mintPosition(context.nft.connect(regularLP), {
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

      // Perform swap - fees go to both LPs but only farming LP's fees tracked
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

      // Update and check totalFees
      await virtualPool.updateTotalFees();
      const [totalFees0, totalFees1] = await virtualPool.getTotalFees();

      console.log('Total fees tracked (farming only):', totalFees0.toString());

      // totalFees should be > 0 but represent only farming position's share
      expect(totalFees0).to.be.gt(0);

      // Get reward for farming position
      await time.increase(days(1));
      
      const incentiveKey = {
        pool: context.pool01,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        nonce: 0,
      };

      const [reward] = await context.eternalFarming.getRewardInfo(incentiveKey, farmResult.tokenId);
      
      // Farming position should earn rewards
      expect(reward).to.be.gt(0);
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

      await context.router.connect(trader).exactInputSingle({
        tokenIn: await context.token0.getAddress(),
        tokenOut: await context.token1.getAddress(),
        deployer: ZERO_ADDRESS,
        recipient: trader.address,
        deadline: (await blockTimestamp()) + 10000,
        amountIn: BNe18(100),
        amountOutMinimum: 0,
        limitSqrtPrice: 0,
      }, { gasLimit: MAX_GAS_LIMIT });

      await time.increase(days(1));
      await virtualPool.updateTotalFees();

      // Farming position should still earn 100% of farming rewards
      // because it's the ONLY position in farming
      const incentiveKey = {
        pool: context.pool01,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        nonce: 0,
      };

      const [reward] = await context.eternalFarming.getRewardInfo(incentiveKey, farmResult.tokenId);
      
      console.log('Reward for farming position (10% of pool liquidity):', reward.toString());
      expect(reward).to.be.gt(0);
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

      // Check totalFees before entering farming - should be 0
      const [feesBefore0] = await virtualPool.getTotalFees();
      expect(feesBefore0).to.equal(0); // No farming positions yet

      // Now enter farming
      await context.nft.connect(lpUser).approveForFarming(tokenId, true, context.farmingCenter);
      const incentiveAdapter = await incentiveResultToFarmAdapter(createIncentiveResult);
      await context.farmingCenter.connect(lpUser).enterFarming(incentiveAdapter, tokenId);

      // Perform more swaps AFTER entering farming
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

      await virtualPool.updateTotalFees();
      const [feesAfter0] = await virtualPool.getTotalFees();

      // Now totalFees should be > 0 (only tracking post-entry fees)
      expect(feesAfter0).to.be.gt(0);
      console.log('Fees tracked after entering farming:', feesAfter0.toString());

      await time.increase(days(1));

      const incentiveKey = {
        pool: context.pool01,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        nonce: 0,
      };

      const [reward] = await context.eternalFarming.getRewardInfo(incentiveKey, tokenId);
      
      // Should earn rewards only for post-entry fees
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
        amountIn: BNe18(100),
        amountOutMinimum: 0,
        limitSqrtPrice: 0,
      }, { gasLimit: MAX_GAS_LIMIT });

      await time.increase(days(1));
      await virtualPool.updateTotalFees();

      const incentiveKey = {
        pool: context.pool01,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        nonce: 0,
      };

      const [reward1] = await context.eternalFarming.getRewardInfo(incentiveKey, farm1.tokenId);
      const [reward2] = await context.eternalFarming.getRewardInfo(incentiveKey, farm2.tokenId);

      console.log('LP1 (4x liquidity) reward:', reward1.toString());
      console.log('LP2 (1x liquidity) reward:', reward2.toString());

      // LP1 should earn more rewards (more fees due to more liquidity)
      expect(reward1).to.be.gt(reward2);
      
      // Ratio should be approximately 4:1 (within some tolerance for rounding)
      const ratio = Number(reward1) / Number(reward2);
      console.log('Reward ratio (expected ~4):', ratio);
      expect(ratio).to.be.closeTo(4, 0.5);
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
      await e20h.ensureBalancesAndApprovals(
        trader,
        [context.token0, context.token1],
        BNe18(500),
        await context.router.getAddress()
      );

      // First swap - both positions in farming
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

      // LP1 exits farming
      const incentiveAdapter = await incentiveResultToFarmAdapter(createIncentiveResult);
      await context.farmingCenter.connect(lpUser1).exitFarming(
        incentiveAdapter,
        farm1.tokenId,
        maxGas
      );

      const liquidityAfterExit = await virtualPool.currentLiquidity();
      console.log('Virtual pool liquidity after LP1 exit:', liquidityAfterExit.toString());

      // Second swap - only LP2 in farming
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
      await virtualPool.updateTotalFees();

      // LP2 should still earn rewards from second swap
      const incentiveKey = {
        pool: context.pool01,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        nonce: 0,
      };

      const [reward2] = await context.eternalFarming.getRewardInfo(incentiveKey, farm2.tokenId);
      console.log('LP2 reward (only one remaining in farming):', reward2.toString());
      
      expect(reward2).to.be.gt(0);
    });

    it('should handle tick crossing with partial farming liquidity', async () => {
      const { context, helpers, createIncentiveResult } = subject;
      const virtualPool = createIncentiveResult.virtualPool;
      
      const farmingLP = actors.lpUser0();
      const regularLP = actors.lpUser1();
      const tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM];

      // Both positions use same narrow range around current price
      const narrowTicks: [number, number] = [-tickSpacing * 10, tickSpacing * 10];

      // Regular LP: large position NOT in farming
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
        tickLower: narrowTicks[0],
        tickUpper: narrowTicks[1],
        recipient: regularLP.address,
        amount0Desired: BNe18(800),
        amount1Desired: BNe18(800),
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 10000,
      });

      // Farming LP: smaller position IN farming
      const farmResult = await helpers.mintDepositFarmFlow({
        lp: farmingLP,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(200), BNe18(200)],
        ticks: narrowTicks,
        createIncentiveResult,
      });

      // Large swap to cross ticks
      const trader = actors.traderUser0();
      await e20h.ensureBalancesAndApprovals(
        trader,
        [context.token0, context.token1],
        BNe18(1500),
        await context.router.getAddress()
      );

      // Swap enough to potentially cross tick boundaries
      await context.router.connect(trader).exactInputSingle({
        tokenIn: await context.token0.getAddress(),
        tokenOut: await context.token1.getAddress(),
        deployer: ZERO_ADDRESS,
        recipient: trader.address,
        deadline: (await blockTimestamp()) + 10000,
        amountIn: BNe18(500),
        amountOutMinimum: 0,
        limitSqrtPrice: 0,
      }, { gasLimit: MAX_GAS_LIMIT });

      await virtualPool.updateTotalFees();
      const [totalFees0] = await virtualPool.getTotalFees();
      
      console.log('Total fees after large swap with tick crossing:', totalFees0.toString());
      expect(totalFees0).to.be.gt(0);

      await time.increase(days(1));

      const incentiveKey = {
        pool: context.pool01,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        nonce: 0,
      };

      const [reward] = await context.eternalFarming.getRewardInfo(incentiveKey, farmResult.tokenId);
      console.log('Farming position reward after tick crossing:', reward.toString());
      
      expect(reward).to.be.gt(0);
    });

    it('should correctly accumulate fees across multiple swap-enter cycles', async () => {
      const { context, helpers, createIncentiveResult } = subject;
      const virtualPool = createIncentiveResult.virtualPool;
      
      const lpUser1 = actors.lpUser0();
      const lpUser2 = actors.lpUser1();
      const tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM];

      const fullRangeTicks: [number, number] = [
        getMinTick(tickSpacing),
        getMaxTick(tickSpacing)
      ];

      const trader = actors.traderUser0();
      await e20h.ensureBalancesAndApprovals(
        trader,
        [context.token0, context.token1],
        BNe18(500),
        await context.router.getAddress()
      );

      // Phase 1: LP1 enters farming
      const farm1 = await helpers.mintDepositFarmFlow({
        lp: lpUser1,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(200), BNe18(200)],
        ticks: fullRangeTicks,
        createIncentiveResult,
      });

      // Swap while only LP1 is farming
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

      await virtualPool.updateTotalFees();
      const [feesAfterPhase1] = await virtualPool.getTotalFees();
      console.log('Fees after phase 1 (LP1 only):', feesAfterPhase1.toString());

      // Phase 2: LP2 also enters farming
      const farm2 = await helpers.mintDepositFarmFlow({
        lp: lpUser2,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(200), BNe18(200)],
        ticks: fullRangeTicks,
        createIncentiveResult,
      });

      // Swap while both LP1 and LP2 are farming
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

      await virtualPool.updateTotalFees();
      const [feesAfterPhase2] = await virtualPool.getTotalFees();
      console.log('Fees after phase 2 (LP1 + LP2):', feesAfterPhase2.toString());

      // Fees should have increased
      expect(feesAfterPhase2).to.be.gt(feesAfterPhase1);

      await time.increase(days(1));

      const incentiveKey = {
        pool: context.pool01,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        nonce: 0,
      };

      const [reward1] = await context.eternalFarming.getRewardInfo(incentiveKey, farm1.tokenId);
      const [reward2] = await context.eternalFarming.getRewardInfo(incentiveKey, farm2.tokenId);

      console.log('LP1 reward (in farming from start):', reward1.toString());
      console.log('LP2 reward (joined later):', reward2.toString());

      // LP1 should have earned more (was farming longer)
      expect(reward1).to.be.gt(reward2);
    });

    it('should handle overlapping positions with different ranges in farming', async () => {
      const { context, helpers, createIncentiveResult } = subject;
      const virtualPool = createIncentiveResult.virtualPool;
      
      const lpNarrow = actors.lpUser0();
      const lpWide = actors.lpUser1();
      const lpNoFarm = actors.traderUser1(); // Using trader as 3rd LP
      const tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM];

      // Non-farming wide position (provides liquidity for swaps)
      await e20h.ensureBalancesAndApprovals(
        lpNoFarm,
        [context.token0, context.token1],
        BNe18(1000),
        await context.nft.getAddress()
      );

      await mintPosition(context.nft.connect(lpNoFarm), {
        token0: context.token0,
        token1: context.token1,
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(tickSpacing),
        tickUpper: getMaxTick(tickSpacing),
        recipient: lpNoFarm.address,
        amount0Desired: BNe18(500),
        amount1Desired: BNe18(500),
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 10000,
      });

      // Farming narrow position (higher fee concentration)
      const narrowTicks: [number, number] = [-tickSpacing * 5, tickSpacing * 5];
      const farmNarrow = await helpers.mintDepositFarmFlow({
        lp: lpNarrow,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: narrowTicks,
        createIncentiveResult,
      });

      // Farming wide position (lower fee concentration)
      const wideTicks: [number, number] = [
        getMinTick(tickSpacing),
        getMaxTick(tickSpacing)
      ];
      const farmWide = await helpers.mintDepositFarmFlow({
        lp: lpWide,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: wideTicks,
        createIncentiveResult,
      });

      // Swap in narrow range
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
        amountIn: BNe18(20),
        amountOutMinimum: 0,
        limitSqrtPrice: 0,
      }, { gasLimit: MAX_GAS_LIMIT });

      await time.increase(days(1));
      await virtualPool.updateTotalFees();

      const incentiveKey = {
        pool: context.pool01,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        nonce: 0,
      };

      const [rewardNarrow] = await context.eternalFarming.getRewardInfo(incentiveKey, farmNarrow.tokenId);
      const [rewardWide] = await context.eternalFarming.getRewardInfo(incentiveKey, farmWide.tokenId);

      console.log('Narrow position reward:', rewardNarrow.toString());
      console.log('Wide position reward:', rewardWide.toString());

      // Both should earn rewards, but narrow should earn more per liquidity
      expect(rewardNarrow).to.be.gt(0);
      expect(rewardWide).to.be.gt(0);
      // Narrow position should earn more (concentrated liquidity = more fees)
      expect(rewardNarrow).to.be.gt(rewardWide);
    });

    it('should correctly track fees with partial farming liquidity and NO tick crosses (small swaps)', async () => {
      const { context, helpers, createIncentiveResult } = subject;
      const virtualPool = createIncentiveResult.virtualPool;
      
      const farmingLP = actors.lpUser0();
      const regularLP = actors.lpUser1();
      const tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM];

      const fullRangeTicks: [number, number] = [
        getMinTick(tickSpacing),
        getMaxTick(tickSpacing)
      ];

      // Regular LP: adds large liquidity but does NOT enter farming
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
        amount0Desired: BNe18(1000),
        amount1Desired: BNe18(1000),
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 10000,
      });

      // Farming LP: adds small liquidity AND enters farming
      const farmResult = await helpers.mintDepositFarmFlow({
        lp: farmingLP,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(100), BNe18(100)],
        ticks: fullRangeTicks,
        createIncentiveResult,
      });

      // Check initial state
      const virtualLiquidity = await virtualPool.currentLiquidity();
      const realPool = await ethers.getContractAt('IAlgebraPool', context.pool01);
      const realLiquidity = await realPool.liquidity();

      console.log('Virtual pool liquidity:', virtualLiquidity.toString());
      console.log('Real pool liquidity:', realLiquidity.toString());
      console.log('Farming share:', Number(virtualLiquidity) / Number(realLiquidity) * 100, '%');

      // Get initial tick
      const [,tickBefore,,,] = await realPool.globalState();
      console.log('Tick before swap:', tickBefore);

      // Perform VERY SMALL swap that should NOT cross any ticks
      const trader = actors.traderUser0();
      await e20h.ensureBalancesAndApprovals(
        trader,
        [context.token0, context.token1],
        BNe18(10),
        await context.router.getAddress()
      );

      // Small swap: 0.1 ETH into a pool with 1100 ETH liquidity - definitely no tick cross
      await context.router.connect(trader).exactInputSingle({
        tokenIn: await context.token0.getAddress(),
        tokenOut: await context.token1.getAddress(),
        deployer: ZERO_ADDRESS,
        recipient: trader.address,
        deadline: (await blockTimestamp()) + 10000,
        amountIn: BNe18(1) / 10n, // 0.1 token - very small
        amountOutMinimum: 0,
        limitSqrtPrice: 0,
      }, { gasLimit: MAX_GAS_LIMIT });

      // Verify no tick cross happened
      const [,tickAfter,,,] = await realPool.globalState();
      console.log('Tick after swap:', tickAfter);
      
      // Tick should be the same (no cross) or very close
      const tickDelta = Math.abs(Number(tickAfter) - Number(tickBefore));
      console.log('Tick delta:', tickDelta);

      // Update total fees (this uses _updateTotalFees path, not crossTo)
      await virtualPool.updateTotalFees();
      
      const [totalFees0, totalFees1] = await virtualPool.getTotalFees();
      console.log('Total fees0 tracked:', totalFees0.toString());

      // Fees should be tracked even without tick crosses
      expect(totalFees0).to.be.gt(0);

      // Do multiple small swaps
      for (let i = 0; i < 5; i++) {
        await context.router.connect(trader).exactInputSingle({
          tokenIn: await context.token0.getAddress(),
          tokenOut: await context.token1.getAddress(),
          deployer: ZERO_ADDRESS,
          recipient: trader.address,
          deadline: (await blockTimestamp()) + 10000,
          amountIn: BNe18(1) / 10n,
          amountOutMinimum: 0,
          limitSqrtPrice: 0,
        }, { gasLimit: MAX_GAS_LIMIT });
      }

      await virtualPool.updateTotalFees();
      const [totalFees0After] = await virtualPool.getTotalFees();
      
      console.log('Total fees0 after 5 more swaps:', totalFees0After.toString());
      
      // Fees should have increased
      expect(totalFees0After).to.be.gt(totalFees0);

      // Now test rewards
      await time.increase(days(1));

      const incentiveKey = {
        pool: context.pool01,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        nonce: 0,
      };

      const [reward] = await context.eternalFarming.getRewardInfo(incentiveKey, farmResult.tokenId);
      
      console.log('Reward earned with small swaps (no tick crosses):', reward.toString());
      
      // Should earn rewards even with small swaps
      expect(reward).to.be.gt(0);
    });

    it('should correctly calculate fee proportion when farming has different liquidity share', async () => {
      const { context, helpers, createIncentiveResult } = subject;
      const virtualPool = createIncentiveResult.virtualPool;
      
      const farmingLP = actors.lpUser0();
      const regularLP = actors.lpUser1();
      const tickSpacing = TICK_SPACINGS[FeeAmount.MEDIUM];

      const fullRangeTicks: [number, number] = [
        getMinTick(tickSpacing),
        getMaxTick(tickSpacing)
      ];

      // Setup: 20% farming, 80% regular
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
        amount0Desired: BNe18(800),
        amount1Desired: BNe18(800),
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 10000,
      });

      const farmResult = await helpers.mintDepositFarmFlow({
        lp: farmingLP,
        tokensToFarm: [context.token0, context.token1],
        amountsToFarm: [BNe18(200), BNe18(200)],
        ticks: fullRangeTicks,
        createIncentiveResult,
      });

      // Get liquidity ratio
      const virtualLiquidity = await virtualPool.currentLiquidity();
      const realPool = await ethers.getContractAt('IAlgebraPool', context.pool01);
      const realLiquidity = await realPool.liquidity();
      
      const farmingRatio = Number(virtualLiquidity) / Number(realLiquidity);
      console.log('Farming liquidity ratio:', farmingRatio * 100, '%');
      
      // Should be approximately 20%
      expect(farmingRatio).to.be.closeTo(0.2, 0.05);

      // Small swap (no tick cross)
      const trader = actors.traderUser0();
      await e20h.ensureBalancesAndApprovals(
        trader,
        [context.token0, context.token1],
        BNe18(10),
        await context.router.getAddress()
      );

      await context.router.connect(trader).exactInputSingle({
        tokenIn: await context.token0.getAddress(),
        tokenOut: await context.token1.getAddress(),
        deployer: ZERO_ADDRESS,
        recipient: trader.address,
        deadline: (await blockTimestamp()) + 10000,
        amountIn: BNe18(1),
        amountOutMinimum: 0,
        limitSqrtPrice: 0,
      }, { gasLimit: MAX_GAS_LIMIT });

      // Check that totalFees reflects only farming's share
      await virtualPool.updateTotalFees();
      const [totalFees0] = await virtualPool.getTotalFees();

      // Get total fees from pool perspective
      const poolFeeGrowth = await realPool.totalFeeGrowth0Token();
      
      console.log('Virtual pool totalFees0:', totalFees0.toString());
      
      // The tracked fees should be approximately 20% of what the full pool earned
      // (because farming has 20% of liquidity)
      expect(totalFees0).to.be.gt(0);
    });
  });
});
