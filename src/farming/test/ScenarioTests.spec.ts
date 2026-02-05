import { ethers } from 'hardhat';
import { Wallet } from 'ethers';
import { loadFixture, impersonateAccount, stopImpersonatingAccount, setBalance, mine } from '@nomicfoundation/hardhat-network-helpers';
import { TestERC20, AlgebraEternalFarming, NftPosManagerMock, FarmingCenter, EternalVirtualPool } from '../typechain';
import { algebraFixture, AlgebraFixtureType, mintPosition } from './shared/fixtures';
import {
  expect,
  getMaxTick,
  getMinTick,
  FeeAmount,
  TICK_SPACINGS,
  blockTimestamp,
  BNe18,
  ActorFixture,
  makeTimestamps,
  ZERO_ADDRESS,
} from './shared';
import { provider } from './shared/provider';
import { HelperCommands, ERC20Helper, incentiveResultToFarmAdapter } from './helpers';
import { createTimeMachine } from './shared/time';
import { HelperTypes } from './helpers/types';
import { ContractParams } from '../types/contractParams';
import { bigint } from 'hardhat/internal/core/params/argumentTypes';

describe('Scenario tests', () => {
  let actors: ActorFixture;
  let lpUser0: Wallet;
  let lpUser1: Wallet;
  let lpUser2: Wallet;
  let incentiveCreator: Wallet;
  const amountDesired = BNe18(10);
  const totalReward = 10000n;
  const bonusReward = 200n;
  const erc20Helper = new ERC20Helper();
  const Time = createTimeMachine();
  let helpers: HelperCommands;
  let context: AlgebraFixtureType;
  let timestamps: ContractParams.Timestamps;
  let nonce = 0n;

  before(async () => {
    const wallets = (await ethers.getSigners()) as any as Wallet[];
    actors = new ActorFixture(wallets, provider);
    lpUser0 = actors.lpUser0();
    lpUser1 = actors.lpUser1();
    lpUser2 = actors.lpUser2();
    incentiveCreator = actors.incentiveCreator();
  });
  beforeEach('create fixture loader', async () => {
    context = await loadFixture(algebraFixture);
    helpers = HelperCommands.fromTestContext(context, actors, provider);
  });
  describe('Scenario 1', () => {
    let createIncentiveResultEternal: HelperTypes.CreateIncentive.Result;
    let tokenIdEternal: string;
    let tokenIdEternalLpUser1;
    let tokensToFarm: [TestERC20, TestERC20]; 


    beforeEach('create fixture loader', async () => {
      // Setup

      timestamps = makeTimestamps(await blockTimestamp());

      console.log(timestamps)
      tokensToFarm = [context.token0, context.token1] as [TestERC20, TestERC20]; 

      await erc20Helper.ensureBalancesAndApprovals(lpUser0, tokensToFarm, amountDesired, await context.nft.getAddress());

      createIncentiveResultEternal = await helpers.createIncentiveFlow({
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: await context.poolObj.getAddress(),
        nonce,
        rewardRate: 1n,
        bonusRewardRate: 1n,
      });


      await Time.setAndMine(timestamps.startTime + 100);

      // const mintResultEternal = await helpers.mintDepositFarmFlow({
      //   lp: lpUser0,
      //   tokensToFarm,
      //   ticks: [getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]), getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])],
      //   amountsToFarm: [amountDesired, amountDesired],
      //   createIncentiveResult: createIncentiveResultEternal,
      // });
      // tokenIdEternal = mintResultEternal.tokenId;
    });
    it('cannot use if not nonfungiblePosManager', async () => {
      await expect(context.farmingCenter.applyLiquidityDelta(tokenIdEternal, 100)).to.be.revertedWith('Only nonfungiblePosManager');
    });

    it('Second user can create LP and deposit to farm', async () => {
      const MintResultLpUser1 = await helpers.mintDepositFarmFlow({
        lp: lpUser1,
        tokensToFarm,
        ticks: [getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]), getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])],
        amountsToFarm: [amountDesired, amountDesired],
        createIncentiveResult: createIncentiveResultEternal,
      })
      tokenIdEternalLpUser1=MintResultLpUser1.tokenId
      expect(BigInt(tokenIdEternalLpUser1)).to.gt(0n)
    })

    it('Make Swap', async () => {
      await Time.setAndMine(timestamps.startTime + 200);

      const incentiveKey = await incentiveResultToFarmAdapter(createIncentiveResultEternal);
      const rewardInfoBefore = await context.eternalFarming.getRewardInfo(
        incentiveKey,
        tokenIdEternal
      );

      console.log(rewardInfoBefore)
      // Wait time for rewards to accumulate
      await Time.setAndMine(timestamps.startTime + 1000);
      
      // const trader = actors.traderUser0();
      // await helpers.makeTickGoFlow({
      //   trader,
      //   direction: 'up',
      //   desiredValue: 10, // Move tick to trigger virtual pool updates
      // });
      
      // Now getRewardInfo should return rewards > 0
      const rewardInfo = await context.eternalFarming.getRewardInfo(
        incentiveKey,
        tokenIdEternal
      );
      console.log('Reward info after makeTickGoFlow:', rewardInfo);
      expect(rewardInfo.reward).to.be.gt(0n); // Should be > 0 now
      
      // Collect rewards to update rewards mapping
      await context.farmingCenter.connect(lpUser0).collectRewards(
        incentiveKey,
        tokenIdEternal
      );
      
      const rewardBalanceBefore = await context.eternalFarming.rewards(
        lpUser0.address,
        context.rewardToken
      );
      console.log('Reward balance before second swap:', rewardBalanceBefore.toString());
      
      const tx = await helpers.makeSwapGasCHeckFlow({
        direction: 'up',
        trader: lpUser2,
        amountIn: 1,
      });
      const receipt = await tx.wait();
      expect(receipt?.gasUsed).to.be.gt(21000n);
      console.log('Gas used:', receipt?.gasUsed?.toString());

      // Collect rewards again after swap
      await context.farmingCenter.connect(lpUser0).collectRewards(
        incentiveKey,
        tokenIdEternal
      );

      const rewardBalanceAfter = await context.eternalFarming.rewards(
        lpUser0.address,
        context.rewardToken
      );

      console.log('Reward balance after second swap:', rewardBalanceAfter.toString());
    });



    /* Two users*/
    it('Two users enter farming at different times, normalized rewards should be equal', async function() {
      const timestampBefore = await blockTimestamp();
      console.log('Test start time:', timestampBefore);
      
      const incentiveKey = await incentiveResultToFarmAdapter(createIncentiveResultEternal);
      const currentTick = (await helpers.pool.connect(lpUser0).globalState()).tick;
      const tickSpacing = await helpers.pool.connect(lpUser0).tickSpacing();
    
      
      const mintLPUser1 = await helpers.mintDepositFarmFlow({
        lp: lpUser1,
        tokensToFarm,
        ticks: [Number(currentTick-10n*tickSpacing), Number(currentTick+10n*tickSpacing)],
        amountsToFarm: [amountDesired, amountDesired],
        createIncentiveResult: createIncentiveResultEternal,
      });
      
      const mintLPUser2 = await helpers.mintDepositFarmFlow({
        lp: lpUser2,
        tokensToFarm,
        ticks: [Number(currentTick-10n*tickSpacing), Number(currentTick+10n*tickSpacing)],
        amountsToFarm: [amountDesired, amountDesired],
        createIncentiveResult: createIncentiveResultEternal,
      });
      
      const totalLiquidity = await helpers.pool.connect(lpUser0).liquidity();
      const liquidityLpUser1 = await helpers.nft.connect(lpUser1).positions(mintLPUser1.tokenId);
      const liquidityLpUser2 = await helpers.nft.connect(lpUser2).positions(mintLPUser2.tokenId);
      
      console.log('Total liquidity:', totalLiquidity.toString());
      console.log('Liquidity User1:', liquidityLpUser1.liquidity.toString());
      console.log('Liquidity User2:', liquidityLpUser2.liquidity.toString());
    
      const farmdAtLpUser1 = mintLPUser1.farmdAt;
      const farmdAtLpUser2 = mintLPUser2.farmdAt;
      console.log('User1 entered at:', farmdAtLpUser1.toString());
      console.log('User2 entered at:', farmdAtLpUser2.toString());
      
      const timestampAfter = await blockTimestamp();
      const checkTime = timestampAfter + 100;
      await Time.setAndMine(checkTime);
      
      console.log('Check rewards at time:', checkTime);
      
      const rewardInfoUser1 = await context.eternalFarming.getRewardInfo(
        incentiveKey,
        mintLPUser1.tokenId
      );
      const rewardInfoUser2 = await context.eternalFarming.getRewardInfo(
        incentiveKey,
        mintLPUser2.tokenId
      );
      
      console.log('Actual reward User1:', rewardInfoUser1.reward.toString());
      console.log('Actual reward User2:', rewardInfoUser2.reward.toString());
    
      const timeSolo = BigInt(farmdAtLpUser2) - BigInt(farmdAtLpUser1); 
      const timeTogether = BigInt(checkTime) - BigInt(farmdAtLpUser2); 
      const totalTimeUser1 = BigInt(checkTime) - BigInt(farmdAtLpUser1); 
      
      console.log('\n--- Time periods ---');
      console.log('Time User1 was alone:', timeSolo.toString(), 'seconds');
      console.log('Time both were farming:', timeTogether.toString(), 'seconds');
      console.log('Total time User1:', totalTimeUser1.toString(), 'seconds');
      
      const rewardRate = 1n;
      
      const expectedRewardUser1Full = (timeSolo * rewardRate) + (timeTogether * rewardRate) / 2n;
      
      const expectedRewardUser2Actual = (timeTogether * rewardRate) / 2n;
      
      console.log('\n--- Expected rewards (theoretical) ---');
      console.log('Expected User1 (full):', expectedRewardUser1Full.toString());
      console.log('Expected User2 (actual):', expectedRewardUser2Actual.toString());
      
      /* Normalization */
      /* Calculate the missed rewards for User2 if he entered the farm at the same time as User1 */
      const missedRewards = (timeSolo * rewardRate) / 2n;
      const normalizedRewardUser2 = BigInt(rewardInfoUser2.reward) + missedRewards;
      
      console.log('\n--- Normalized comparison ---');
      console.log('User1 actual reward:', rewardInfoUser1.reward.toString());
      console.log('User2 missed rewards (if entered together):', missedRewards.toString());
      console.log('User2 normalized reward:', normalizedRewardUser2.toString());
      
      /* Check the difference between the actual reward and the normalized reward */
      const difference = rewardInfoUser1.reward > normalizedRewardUser2
        ? BigInt(rewardInfoUser1.reward) - normalizedRewardUser2
        : normalizedRewardUser2 - BigInt(rewardInfoUser1.reward);
      
      console.log('Difference:', difference.toString());
      console.log('Difference %:', Number(difference * 10000n / BigInt(rewardInfoUser1.reward)) / 100, '%');
      
      /* Check the difference should be minimal */
      /* The difference should be less than the timeSolo */
      const maxAllowedDifference = timeSolo; 
      expect(difference).to.be.lte(maxAllowedDifference, 
        `Normalized rewards differ too much. User1: ${rewardInfoUser1.reward}, User2 normalized: ${normalizedRewardUser2}`
      );
      
      /* Alternative check: compare the average rewards per second */
      const avgRewardPerSecUser1 = BigInt(rewardInfoUser1.reward) * 1000000n / totalTimeUser1;
      const avgRewardPerSecUser2 = BigInt(rewardInfoUser2.reward) * 1000000n / timeTogether;
      
      console.log('\n--- Average rewards per second (scaled by 1M) ---');
      console.log('User1 avg reward/sec:', avgRewardPerSecUser1.toString());
      console.log('User2 avg reward/sec:', avgRewardPerSecUser2.toString());
      
      /* User2 should receive approximately the same amount per second as User1 received during the timeTogether (when they shared rewards) */
      /* User1 received rewardRate/2 during the timeTogether, User2 also received rewardRate/2 */
      expect(avgRewardPerSecUser2).to.be.closeTo(avgRewardPerSecUser1, avgRewardPerSecUser1 / 10n);
    });

    it('Three users enter farming at different times, normalized rewards should be equal', async function() {
      const timestampBefore = await blockTimestamp();
      console.log('Test start time:', timestampBefore);
      
      const incentiveKey = await incentiveResultToFarmAdapter(createIncentiveResultEternal);
      const currentTick = (await helpers.pool.connect(lpUser0).globalState()).tick;
      const tickSpacing = await helpers.pool.connect(lpUser0).tickSpacing();
    
      const mintLPUser1 = await helpers.mintDepositFarmFlow({
        lp: lpUser1,
        tokensToFarm,
        ticks: [Number(currentTick-10n*tickSpacing), Number(currentTick+10n*tickSpacing)],
        amountsToFarm: [amountDesired, amountDesired],
        createIncentiveResult: createIncentiveResultEternal,
      });
      
      const mintLPUser2 = await helpers.mintDepositFarmFlow({
        lp: lpUser2,
        tokensToFarm,
        ticks: [Number(currentTick-10n*tickSpacing), Number(currentTick+10n*tickSpacing)],
        amountsToFarm: [amountDesired, amountDesired],
        createIncentiveResult: createIncentiveResultEternal,
      });
      
      const mintLPUser0 = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm,
        ticks: [Number(currentTick-10n*tickSpacing), Number(currentTick+10n*tickSpacing)],
        amountsToFarm: [amountDesired, amountDesired],
        createIncentiveResult: createIncentiveResultEternal,
      });
      
      const liquidityUser1 = await helpers.nft.connect(lpUser1).positions(mintLPUser1.tokenId);
      const liquidityUser2 = await helpers.nft.connect(lpUser2).positions(mintLPUser2.tokenId);
      const liquidityUser0 = await helpers.nft.connect(lpUser0).positions(mintLPUser0.tokenId);
      
      console.log('\n--- Liquidity ---');
      console.log('Liquidity User1:', liquidityUser1.liquidity.toString());
      console.log('Liquidity User2:', liquidityUser2.liquidity.toString());
      console.log('Liquidity User0:', liquidityUser0.liquidity.toString());
    
      const farmdAtUser1 = BigInt(mintLPUser1.farmdAt);
      const farmdAtUser2 = BigInt(mintLPUser2.farmdAt);
      const farmdAtUser0 = BigInt(mintLPUser0.farmdAt);
      
      console.log('\n--- Entry times ---');
      console.log('User1 entered at:', farmdAtUser1.toString());
      console.log('User2 entered at:', farmdAtUser2.toString());
      console.log('User0 entered at:', farmdAtUser0.toString());
      
      const timestampAfter = await blockTimestamp();
      const checkTime = timestampAfter + 100;
      await Time.setAndMine(checkTime);
      
      console.log('Check rewards at time:', checkTime);
      
      /* Get the actual rewards */
      const rewardInfoUser1 = await context.eternalFarming.getRewardInfo(
        incentiveKey,
        mintLPUser1.tokenId
      );
      const rewardInfoUser2 = await context.eternalFarming.getRewardInfo(
        incentiveKey,
        mintLPUser2.tokenId
      );
      const rewardInfoUser0 = await context.eternalFarming.getRewardInfo(
        incentiveKey,
        mintLPUser0.tokenId
      );
      
      console.log('\n--- Actual rewards ---');
      console.log('User1 reward:', rewardInfoUser1.reward.toString());
      console.log('User2 reward:', rewardInfoUser2.reward.toString());
      console.log('User0 reward:', rewardInfoUser0.reward.toString());
    
      /* Calculate the periods */
      const period1_User1Alone = farmdAtUser2 - farmdAtUser1; /* Only User1 */
      const period2_Users1And2 = farmdAtUser0 - farmdAtUser2; /* User1 + User2 */
      const period3_AllThree = BigInt(checkTime) - farmdAtUser0; /* User1 + User2 + User0 */
      
      console.log('\n--- Time periods ---');
      console.log('Period 1 (User1 alone):', period1_User1Alone.toString(), 'seconds');
      console.log('Period 2 (User1+User2):', period2_Users1And2.toString(), 'seconds');
      console.log('Period 3 (All three):', period3_AllThree.toString(), 'seconds');
      
      const rewardRates = await helpers.getRewardRate({
        createIncentiveResult: createIncentiveResultEternal
      });
      const rewardRate = rewardRates.rewardRate0;
      
      /* Theoretical rewards for each period */
      console.log('\n--- Theoretical rewards per period ---');
      
      /* Period 1: User1 receives 100% */
      const period1Rewards = period1_User1Alone * rewardRate;
      console.log('Period 1 total rewards:', period1Rewards.toString());
      console.log('  User1 gets 100%:', period1Rewards.toString());
      
      /* Period 2: User1 and User2 receive 50% */
      const period2Rewards = period2_Users1And2 * rewardRate;
      console.log('Period 2 total rewards:', period2Rewards.toString());
      console.log('  User1 gets 50%:', (period2Rewards / 2n).toString());
      console.log('  User2 gets 50%:', (period2Rewards / 2n).toString());
      
      /* Period 3: All three receive 33.33% */
      const period3Rewards = period3_AllThree * rewardRate;
      console.log('Period 3 total rewards:', period3Rewards.toString());
      console.log('  User1 gets 33.33%:', (period3Rewards / 3n).toString());
      console.log('  User2 gets 33.33%:', (period3Rewards / 3n).toString());
      console.log('  User0 gets 33.33%:', (period3Rewards / 3n).toString());
      
      /* Expected actual rewards */
      const expectedUser1 = period1Rewards + period2Rewards / 2n + period3Rewards / 3n;
      const expectedUser2 = period2Rewards / 2n + period3Rewards / 3n;
      const expectedUser0 = period3Rewards / 3n;
      
      console.log('\n--- Expected actual rewards ---');
      console.log('User1 expected:', expectedUser1.toString());
      console.log('User2 expected:', expectedUser2.toString());
      console.log('User0 expected:', expectedUser0.toString());
      
      /* Normalization: bring all to the time of User1 entry */
      /* User1: without changes (he entered first) */
      const normalizedUser1 = BigInt(rewardInfoUser1.reward);
      
      /* User2: add rewards, which he would receive for Period 1 */
      /* If he participated with User1 in Period 1, they would share rewards 50/50 */
      const missedRewardsUser2_Period1 = period1Rewards / 2n;
      const normalizedUser2 = BigInt(rewardInfoUser2.reward) + missedRewardsUser2_Period1;
      
      /* User0: add rewards for Period 1 and Period 2 */
      /* Period 1: if all three participated, User0 would receive 33.33% */
      const missedRewardsUser0_Period1 = period1Rewards / 3n;
      /* Period 2: if all three participated, User0 would receive 33.33% */
      const missedRewardsUser0_Period2 = period2Rewards / 3n;
      const normalizedUser0 = BigInt(rewardInfoUser0.reward) + missedRewardsUser0_Period1 + missedRewardsUser0_Period2;
      
      console.log('\n--- Normalized rewards (as if all entered together) ---');
      console.log('User1 normalized:', normalizedUser1.toString());
      console.log('User2 normalized:', normalizedUser2.toString(), 
        `(+${missedRewardsUser2_Period1} for Period 1)`);
      console.log('User0 normalized:', normalizedUser0.toString(), 
        `(+${missedRewardsUser0_Period1} for Period 1, +${missedRewardsUser0_Period2} for Period 2)`);
      
      /* Calculate the difference between the normalized rewards */
      const avgNormalized = (normalizedUser1 + normalizedUser2 + normalizedUser0) / 3n;
      
      const diff1 = normalizedUser1 > avgNormalized 
        ? normalizedUser1 - avgNormalized 
        : avgNormalized - normalizedUser1;
      const diff2 = normalizedUser2 > avgNormalized 
        ? normalizedUser2 - avgNormalized 
        : avgNormalized - normalizedUser2;
      const diff0 = normalizedUser0 > avgNormalized 
        ? normalizedUser0 - avgNormalized 
        : avgNormalized - normalizedUser0;
      
      console.log('\n--- Differences from average ---');
      console.log('Average normalized:', avgNormalized.toString());
      console.log('User1 diff:', diff1.toString(), `(${Number(diff1 * 10000n / avgNormalized) / 100}%)`);
      console.log('User2 diff:', diff2.toString(), `(${Number(diff2 * 10000n / avgNormalized) / 100}%)`);
      console.log('User0 diff:', diff0.toString(), `(${Number(diff0 * 10000n / avgNormalized) / 100}%)`);
      
        /* Check: all normalized rewards should be approximately equal */
      /* Allow for error due to rounding */
      const maxAllowedDiffPercent = 1100n; /* 11% = 1100 basis points */
      
      expect(diff1 * 10000n / avgNormalized).to.be.lte(maxAllowedDiffPercent,
        `User1 normalized reward differs too much from average`);
      expect(diff2 * 10000n / avgNormalized).to.be.lte(maxAllowedDiffPercent,
         `User2 normalized reward differs too much from average`);
       expect(diff0 * 10000n / avgNormalized).to.be.lte(maxAllowedDiffPercent,
         `User0 normalized reward differs too much from average`);
      
      /* Alternative check: average reward per second */
      const totalTimeUser1 = BigInt(checkTime) - farmdAtUser1;
      const totalTimeUser2 = BigInt(checkTime) - farmdAtUser2;
      const totalTimeUser0 = BigInt(checkTime) - farmdAtUser0;
      
      const avgRewardPerSecUser1 = BigInt(rewardInfoUser1.reward) * 1000000n / totalTimeUser1;
      const avgRewardPerSecUser2 = BigInt(rewardInfoUser2.reward) * 1000000n / totalTimeUser2;
      const avgRewardPerSecUser0 = BigInt(rewardInfoUser0.reward) * 1000000n / totalTimeUser0;
      
      console.log('\n--- Average rewards per second (scaled by 1M) ---');
      console.log('User1 avg reward/sec:', avgRewardPerSecUser1.toString());
      console.log('User2 avg reward/sec:', avgRewardPerSecUser2.toString());
      console.log('User0 avg reward/sec:', avgRewardPerSecUser0.toString());
      
      /* Check the sum of all rewards */
      const totalRewardsDistributed = BigInt(rewardInfoUser1.reward) + 
                                       BigInt(rewardInfoUser2.reward) + 
                                       BigInt(rewardInfoUser0.reward);
      const totalRewardsExpected = (BigInt(checkTime) - farmdAtUser1) * rewardRate;
      
      console.log('\n--- Total rewards verification ---');
      console.log('Total distributed:', totalRewardsDistributed.toString());
      console.log('Total expected:', totalRewardsExpected.toString());
      console.log('Difference:', (totalRewardsExpected - totalRewardsDistributed).toString());
      
      /* The sum of all rewards should be approximately equal to the total time * rewardRate */
      const totalDiff = totalRewardsExpected > totalRewardsDistributed
        ? totalRewardsExpected - totalRewardsDistributed
        : totalRewardsDistributed - totalRewardsExpected;
      
      expect(totalDiff).to.be.lte(10n, 'Total rewards distributed should match expected');
    });

    it("Three users enter farming with different amounts of liquidity", async () =>{
      const timestampBefore = await blockTimestamp();

      const incentiveKey = await incentiveResultToFarmAdapter(createIncentiveResultEternal);
      const currentTick = (await helpers.pool.connect(lpUser0).globalState()).tick;
      const tickSpacing = await helpers.pool.connect(lpUser0).tickSpacing();

      const mintLPUser0 = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm,
        ticks: [Number(currentTick-1n*tickSpacing), Number(currentTick+1n*tickSpacing)],
        amountsToFarm: [amountDesired, amountDesired],
        createIncentiveResult: createIncentiveResultEternal,
      });

      const mintLPUser1 = await helpers.mintDepositFarmFlow({
        lp: lpUser1,
        tokensToFarm,
        ticks: [Number(currentTick-2n*tickSpacing), Number(currentTick+2n*tickSpacing)],
        amountsToFarm: [amountDesired, amountDesired],
        createIncentiveResult: createIncentiveResultEternal,
      });

      const mintLPUser2 = await helpers.mintDepositFarmFlow({
        lp: lpUser2,
        tokensToFarm,
        ticks: [Number(currentTick-10n*tickSpacing), Number(currentTick+10n*tickSpacing)],
        amountsToFarm: [amountDesired, amountDesired],
        createIncentiveResult: createIncentiveResultEternal,
      });

      const liquidityUser0 = await helpers.nft.connect(lpUser0).positions(mintLPUser0.tokenId);
      const liquidityUser1 = await helpers.nft.connect(lpUser1).positions(mintLPUser1.tokenId);
      const liquidityUser2 = await helpers.nft.connect(lpUser2).positions(mintLPUser2.tokenId);

      console.log('\n--- Liquidity ---');
      console.log('Liquidity User0:', liquidityUser0.liquidity.toString());
      console.log('Liquidity User1:', liquidityUser1.liquidity.toString());
      console.log('Liquidity User2:', liquidityUser2.liquidity.toString());

      const farmdAtUser0 = BigInt(mintLPUser0.farmdAt);
      const farmdAtUser1 = BigInt(mintLPUser1.farmdAt);
      const farmdAtUser2 = BigInt(mintLPUser2.farmdAt);

      const timestampAfter = await blockTimestamp();
      const checkTime = timestampAfter + 1000;
      await Time.setAndMine(checkTime);

      console.log('Check rewards at time:', checkTime);

      const rewardInfoUser0 = await context.eternalFarming.getRewardInfo(
        incentiveKey,
        mintLPUser0.tokenId);
      const rewardInfoUser1 = await context.eternalFarming.getRewardInfo(
        incentiveKey,
        mintLPUser1.tokenId);
      const rewardInfoUser2 = await context.eternalFarming.getRewardInfo(
        incentiveKey,
        mintLPUser2.tokenId);

      console.log('\n--- Actual rewards ---');
      console.log('User0 reward:', rewardInfoUser0.reward.toString());
      console.log('User1 reward:', rewardInfoUser1.reward.toString());
      console.log('User2 reward:', rewardInfoUser2.reward.toString());

      const period1_User0Alone = farmdAtUser1 - farmdAtUser0; /* Only User0 */
      const period2_Users0And1 = farmdAtUser2 - farmdAtUser1; /* User0 + User1 */
      const period3_AllThree = BigInt(checkTime) - farmdAtUser2; /* User0 + User1 + User2 */

      console.log('\n--- Time periods ---');
      console.log('Period 1 (User0 alone):', period1_User0Alone.toString(), 'seconds');
      console.log('Period 2 (User0+User1):', period2_Users0And1.toString(), 'seconds');
      console.log('Period 3 (All three):', period3_AllThree.toString(), 'seconds');

      
      
    })

    it("Three users enter farming with different amounts of liquidity#2", async () => {
      const timestampBefore = await blockTimestamp();
    
      const incentiveKey = await incentiveResultToFarmAdapter(createIncentiveResultEternal);
      const currentTick = (await helpers.pool.connect(lpUser0).globalState()).tick;
      const tickSpacing = await helpers.pool.connect(lpUser0).tickSpacing();
    
      const mintLPUser0 = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm,
        ticks: [Number(currentTick-1n*tickSpacing), Number(currentTick+1n*tickSpacing)],
        amountsToFarm: [amountDesired, amountDesired],
        createIncentiveResult: createIncentiveResultEternal,
      });
    
      const mintLPUser1 = await helpers.mintDepositFarmFlow({
        lp: lpUser1,
        tokensToFarm,
        ticks: [Number(currentTick-2n*tickSpacing), Number(currentTick+2n*tickSpacing)],
        amountsToFarm: [amountDesired, amountDesired],
        createIncentiveResult: createIncentiveResultEternal,
      });
    
      const mintLPUser2 = await helpers.mintDepositFarmFlow({
        lp: lpUser2,
        tokensToFarm,
        ticks: [Number(currentTick-10n*tickSpacing), Number(currentTick+10n*tickSpacing)],
        amountsToFarm: [amountDesired, amountDesired],
        createIncentiveResult: createIncentiveResultEternal,
      });
    
      const liquidityUser0 = await helpers.nft.connect(lpUser0).positions(mintLPUser0.tokenId);
      const liquidityUser1 = await helpers.nft.connect(lpUser1).positions(mintLPUser1.tokenId);
      const liquidityUser2 = await helpers.nft.connect(lpUser2).positions(mintLPUser2.tokenId);
    
      const liq0 = BigInt(liquidityUser0.liquidity);
      const liq1 = BigInt(liquidityUser1.liquidity);
      const liq2 = BigInt(liquidityUser2.liquidity);
    
      console.log('\n--- Liquidity ---');
      console.log('Liquidity User0:', liq0.toString());
      console.log('Liquidity User1:', liq1.toString());
      console.log('Liquidity User2:', liq2.toString());
    
      const farmdAtUser0 = BigInt(mintLPUser0.farmdAt);
      const farmdAtUser1 = BigInt(mintLPUser1.farmdAt);
      const farmdAtUser2 = BigInt(mintLPUser2.farmdAt);
    
      console.log('\n--- Entry times ---');
      console.log('User0 entered at:', farmdAtUser0.toString());
      console.log('User1 entered at:', farmdAtUser1.toString());
      console.log('User2 entered at:', farmdAtUser2.toString());
    
      const timestampAfter = await blockTimestamp();
      const checkTime = timestampAfter + 1000;
      await Time.setAndMine(checkTime);
    
      console.log('Check rewards at time:', checkTime);
    
      const rewardInfoUser0 = await context.eternalFarming.getRewardInfo(
        incentiveKey,
        mintLPUser0.tokenId
      );
      const rewardInfoUser1 = await context.eternalFarming.getRewardInfo(
        incentiveKey,
        mintLPUser1.tokenId
      );
      const rewardInfoUser2 = await context.eternalFarming.getRewardInfo(
        incentiveKey,
        mintLPUser2.tokenId
      );
    
      const reward0 = BigInt(rewardInfoUser0.reward);
      const reward1 = BigInt(rewardInfoUser1.reward);
      const reward2 = BigInt(rewardInfoUser2.reward);
    
      console.log('\n--- Actual rewards ---');
      console.log('User0 reward:', reward0.toString());
      console.log('User1 reward:', reward1.toString());
      console.log('User2 reward:', reward2.toString());
    
      const period1_User0Alone = farmdAtUser1 - farmdAtUser0; 
      const period2_Users0And1 = farmdAtUser2 - farmdAtUser1; 
      const period3_AllThree = BigInt(checkTime) - farmdAtUser2; 
    
      console.log('\n--- Time periods ---');
      console.log('Period 1 (User0 alone):', period1_User0Alone.toString(), 'seconds');
      console.log('Period 2 (User0+User1):', period2_Users0And1.toString(), 'seconds');
      console.log('Period 3 (All three):', period3_AllThree.toString(), 'seconds');
    
      const rewardRates = await helpers.getRewardRate({
        createIncentiveResult: createIncentiveResultEternal
      });
      const rewardRate = rewardRates.rewardRate0;
    
      console.log('\n--- Expected rewards calculation ---');
    
      const period1TotalRewards = period1_User0Alone * rewardRate;
      const expectedReward0_Period1 = period1TotalRewards; 
      console.log('Period 1 rewards (User0 alone):', expectedReward0_Period1.toString());
    
      const period2TotalRewards = period2_Users0And1 * rewardRate;
      const totalLiqPeriod2 = liq0 + liq1;
      const expectedReward0_Period2 = (period2TotalRewards * liq0) / totalLiqPeriod2;
      const expectedReward1_Period2 = (period2TotalRewards * liq1) / totalLiqPeriod2;
      
      console.log('Period 2 total rewards:', period2TotalRewards.toString());
      console.log('  Total liquidity:', totalLiqPeriod2.toString());
      console.log('  User0 share:', (liq0 * 10000n / totalLiqPeriod2).toString(), 'bp (basis points)');
      console.log('  User1 share:', (liq1 * 10000n / totalLiqPeriod2).toString(), 'bp');
      console.log('  User0 expected:', expectedReward0_Period2.toString());
      console.log('  User1 expected:', expectedReward1_Period2.toString());
    
      const period3TotalRewards = period3_AllThree * rewardRate;
      const totalLiqPeriod3 = liq0 + liq1 + liq2;
      const expectedReward0_Period3 = (period3TotalRewards * liq0) / totalLiqPeriod3;
      const expectedReward1_Period3 = (period3TotalRewards * liq1) / totalLiqPeriod3;
      const expectedReward2_Period3 = (period3TotalRewards * liq2) / totalLiqPeriod3;
    
      console.log('Period 3 total rewards:', period3TotalRewards.toString());
      console.log('  Total liquidity:', totalLiqPeriod3.toString());
      console.log('  User0 share:', (liq0 * 10000n / totalLiqPeriod3).toString(), 'bp');
      console.log('  User1 share:', (liq1 * 10000n / totalLiqPeriod3).toString(), 'bp');
      console.log('  User2 share:', (liq2 * 10000n / totalLiqPeriod3).toString(), 'bp');
      console.log('  User0 expected:', expectedReward0_Period3.toString());
      console.log('  User1 expected:', expectedReward1_Period3.toString());
      console.log('  User2 expected:', expectedReward2_Period3.toString());
    
      const expectedTotalReward0 = expectedReward0_Period1 + expectedReward0_Period2 + expectedReward0_Period3;
      const expectedTotalReward1 = expectedReward1_Period2 + expectedReward1_Period3;
      const expectedTotalReward2 = expectedReward2_Period3;
    
      console.log('\n--- Total expected rewards ---');
      console.log('User0 expected total:', expectedTotalReward0.toString());
      console.log('User1 expected total:', expectedTotalReward1.toString());
      console.log('User2 expected total:', expectedTotalReward2.toString());
    
      console.log('\n--- Actual vs Expected ---');
      console.log('User0: actual', reward0.toString(), 'vs expected', expectedTotalReward0.toString());
      console.log('User1: actual', reward1.toString(), 'vs expected', expectedTotalReward1.toString());
      console.log('User2: actual', reward2.toString(), 'vs expected', expectedTotalReward2.toString());
    
      const diff0 = reward0 > expectedTotalReward0 
        ? reward0 - expectedTotalReward0 
        : expectedTotalReward0 - reward0;
      const diff1 = reward1 > expectedTotalReward1 
        ? reward1 - expectedTotalReward1 
        : expectedTotalReward1 - reward1;
      const diff2 = reward2 > expectedTotalReward2 
        ? reward2 - expectedTotalReward2 
        : expectedTotalReward2 - reward2;
    
      const diffPercent0 = expectedTotalReward0 > 0n 
        ? (diff0 * 10000n) / expectedTotalReward0 
        : 0n;
      const diffPercent1 = expectedTotalReward1 > 0n 
        ? (diff1 * 10000n) / expectedTotalReward1 
        : 0n;
      const diffPercent2 = expectedTotalReward2 > 0n 
        ? (diff2 * 10000n) / expectedTotalReward2 
        : 0n;
    
      console.log('\n--- Percentage differences ---');
      console.log('User0 diff:', diff0.toString(), `(${Number(diffPercent0) / 100}%)`);
      console.log('User1 diff:', diff1.toString(), `(${Number(diffPercent1) / 100}%)`);
      console.log('User2 diff:', diff2.toString(), `(${Number(diffPercent2) / 100}%)`);
    
      const maxAllowedDiffBp = 200n; // 2%
      
      expect(diffPercent0).to.be.lte(maxAllowedDiffBp, 
        `User0 reward differs too much: actual ${reward0}, expected ${expectedTotalReward0}`);
      expect(diffPercent1).to.be.lte(maxAllowedDiffBp, 
        `User1 reward differs too much: actual ${reward1}, expected ${expectedTotalReward1}`);
      expect(diffPercent2).to.be.lte(maxAllowedDiffBp, 
        `User2 reward differs too much: actual ${reward2}, expected ${expectedTotalReward2}`);
    
      // check the ratio between users
      // the ratio of rewards should be approximately equal to the average liquidity
      console.log('\n--- Reward ratios ---');
      
      // average weighted liquidity for all time
      const totalTime0 = BigInt(checkTime) - farmdAtUser0;
      const totalTime1 = BigInt(checkTime) - farmdAtUser1;
      const totalTime2 = BigInt(checkTime) - farmdAtUser2;
      
      const avgWeightedLiq0 = (liq0 * totalTime0) / totalTime0; 
      const avgWeightedLiq1 = (liq1 * totalTime1) / totalTime1; 
      const avgWeightedLiq2 = (liq2 * totalTime2) / totalTime2; 
      
      // check that the rewards are approximately proportional to the liquidity
      // reward0 / liq0 ≈ reward1 / liq1 ≈ reward2 / liq2 (with respect to the time of participation)
      
      const rewardPerLiq0 = (reward0 * 1000000n) / liq0 / totalTime0;
      const rewardPerLiq1 = (reward1 * 1000000n) / liq1 / totalTime1;
      const rewardPerLiq2 = (reward2 * 1000000n) / liq2 / totalTime2;
      
      console.log('Reward per liquidity per second (scaled by 1M):');
      console.log('  User0:', rewardPerLiq0.toString());
      console.log('  User1:', rewardPerLiq1.toString());
      console.log('  User2:', rewardPerLiq2.toString());
      
      // These values should be approximately equal (within 5%)
      const avgRewardPerLiq = (rewardPerLiq0 + rewardPerLiq1 + rewardPerLiq2) / 3n;
      
      const ratioCheck0 = avgRewardPerLiq > 0n 
        ? ((rewardPerLiq0 > avgRewardPerLiq ? rewardPerLiq0 - avgRewardPerLiq : avgRewardPerLiq - rewardPerLiq0) * 10000n) / avgRewardPerLiq
        : 0n;
      const ratioCheck1 = avgRewardPerLiq > 0n 
        ? ((rewardPerLiq1 > avgRewardPerLiq ? rewardPerLiq1 - avgRewardPerLiq : avgRewardPerLiq - rewardPerLiq1) * 10000n) / avgRewardPerLiq
        : 0n;
      const ratioCheck2 = avgRewardPerLiq > 0n 
        ? ((rewardPerLiq2 > avgRewardPerLiq ? rewardPerLiq2 - avgRewardPerLiq : avgRewardPerLiq - rewardPerLiq2) * 10000n) / avgRewardPerLiq
        : 0n;
      
      // check the sum of rewards
      const totalRewardsDistributed = reward0 + reward1 + reward2;
      const totalRewardsExpected = (BigInt(checkTime) - farmdAtUser0) * rewardRate;
      
      console.log('\n--- Total rewards check ---');
      console.log('Total distributed:', totalRewardsDistributed.toString());
      console.log('Total expected:', totalRewardsExpected.toString());
      
      const totalDiff = totalRewardsExpected > totalRewardsDistributed
        ? totalRewardsExpected - totalRewardsDistributed
        : totalRewardsDistributed - totalRewardsExpected;
      
      console.log('Difference:', totalDiff.toString());
      
      expect(totalDiff).to.be.lte(10n, 'Total rewards should match expected');
    });

    /* First user with narrow tick range don't get rewards after swap 
    because tick in pool moved more than 60 */
    it('Three users enter farming and move tick to 100', async () =>{
      const timestampBefore = await blockTimestamp();

      const incentiveKey = await incentiveResultToFarmAdapter(createIncentiveResultEternal);
      const currentTick = (await helpers.pool.connect(lpUser0).globalState()).tick;
      const tickSpacing = await helpers.pool.connect(lpUser0).tickSpacing();

      const mintLPUser0 = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm,
        ticks: [Number(currentTick-1n*tickSpacing), Number(currentTick+1n*tickSpacing)],
        amountsToFarm: [amountDesired, amountDesired],
        createIncentiveResult: createIncentiveResultEternal,
      });

      const mintLPUser1 = await helpers.mintDepositFarmFlow({
        lp: lpUser1,
        tokensToFarm,
        ticks: [Number(currentTick-2n*tickSpacing), Number(currentTick+2n*tickSpacing)],
        amountsToFarm: [amountDesired, amountDesired],
        createIncentiveResult: createIncentiveResultEternal,
      });

      const mintLPUser2 = await helpers.mintDepositFarmFlow({
        lp: lpUser2,
        tokensToFarm,
        ticks: [Number(currentTick-20n*tickSpacing), Number(currentTick+20n*tickSpacing)],
        amountsToFarm: [amountDesired*100n, amountDesired*100n],
        createIncentiveResult: createIncentiveResultEternal,
      });

      const liquidityUser0 = await helpers.nft.connect(lpUser0).positions(mintLPUser0.tokenId);
      const liquidityUser1 = await helpers.nft.connect(lpUser1).positions(mintLPUser1.tokenId);
      const liquidityUser2 = await helpers.nft.connect(lpUser2).positions(mintLPUser2.tokenId);

      console.log('\n--- Liquidity ---');
      console.log('Liquidity User0:', liquidityUser0.liquidity.toString());
      console.log('Liquidity User1:', liquidityUser1.liquidity.toString());
      console.log('Liquidity User2:', liquidityUser2.liquidity.toString());

      const farmdAtUser0 = BigInt(mintLPUser0.farmdAt);
      const farmdAtUser1 = BigInt(mintLPUser1.farmdAt);
      const farmdAtUser2 = BigInt(mintLPUser2.farmdAt);

      const timestampAfter = await blockTimestamp();
      const checkTime = timestampAfter + 100;
      await Time.setAndMine(checkTime);

      console.log('Check rewards at time:', checkTime);

      const rewardInfoUser0Before = await context.eternalFarming.getRewardInfo(
        incentiveKey,
        mintLPUser0.tokenId);
      const rewardInfoUser1Before = await context.eternalFarming.getRewardInfo(
        incentiveKey,
        mintLPUser1.tokenId);
      const rewardInfoUser2Before = await context.eternalFarming.getRewardInfo(
        incentiveKey,
        mintLPUser2.tokenId);

      console.log('\n--- Actual rewards ---');
      console.log('User0 reward before:', rewardInfoUser0Before.reward.toString());
      console.log('User1 reward before:', rewardInfoUser1Before.reward.toString());
      console.log('User2 reward before:', rewardInfoUser2Before.reward.toString());

       
    

      await helpers.moveTickTo({
        trader: lpUser0,
        direction: 'up',
        desiredValue: 100,
      })

      await Time.setAndMine(await blockTimestamp() + 1000);



      const rewardInfoUser0After = await context.eternalFarming.getRewardInfo(
        incentiveKey,
        mintLPUser0.tokenId);
      const rewardInfoUser1After = await context.eternalFarming.getRewardInfo(
        incentiveKey,
        mintLPUser1.tokenId);
      const rewardInfoUser2After = await context.eternalFarming.getRewardInfo(
        incentiveKey,
        mintLPUser2.tokenId);

      console.log('\n--- Actual rewards after swap ---');
      console.log('User0 reward after:', rewardInfoUser0After.reward.toString());
      console.log('User1 reward after:', rewardInfoUser1After.reward.toString());
      console.log('User2 reward after:', rewardInfoUser2After.reward.toString());

      const diff0 = BigInt(rewardInfoUser0After.reward) - BigInt(rewardInfoUser0Before.reward);
      const diff1 = BigInt(rewardInfoUser1After.reward) - BigInt(rewardInfoUser1Before.reward);
      const diff2 = BigInt(rewardInfoUser2After.reward) - BigInt(rewardInfoUser2Before.reward);

      const rewardBefore0 = BigInt(rewardInfoUser0Before.reward);
      const rewardBefore1 = BigInt(rewardInfoUser1Before.reward);
      const rewardBefore2 = BigInt(rewardInfoUser2Before.reward);

      const diffPercent0 = rewardBefore0 > 0n 
        ? (diff0 * 100n) / rewardBefore0 
        : 0n;
      const diffPercent1 = rewardBefore1 > 0n 
        ? (diff1 * 100n) / rewardBefore1 
        : 0n;
      const diffPercent2 = rewardBefore2 > 0n 
        ? (diff2 * 100n) / rewardBefore2 
        : 0n;

      expect(diffPercent0).to.be.lt(10n);
      expect(diffPercent1).to.be.gt(30n);
      expect(diffPercent2).to.be.gt(30n);


    });
    it('Fantom liquidity farming', async ()=>{
      const timestampBefore = await blockTimestamp();

      const incentiveKey = await incentiveResultToFarmAdapter(createIncentiveResultEternal);
      const currentTick = (await helpers.pool.connect(lpUser0).globalState()).tick;
      const tickSpacing = await helpers.pool.connect(lpUser0).tickSpacing();

      const mintLPUser0 = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm,
        ticks: [Number(currentTick-10n*tickSpacing), Number(currentTick+10n*tickSpacing)],
        amountsToFarm: [amountDesired, amountDesired],
        createIncentiveResult: createIncentiveResultEternal,
      });

      const mintLPUser1 = await helpers.mintDepositFarmFlow({
        lp: lpUser1,
        tokensToFarm,
        ticks: [Number(currentTick-10n*tickSpacing), Number(currentTick+10n*tickSpacing)],
        amountsToFarm: [amountDesired, amountDesired],
        createIncentiveResult: createIncentiveResultEternal,
      });

      const mintLPUser2 = await helpers.mintDepositFarmFlow({
        lp: lpUser2,
        tokensToFarm,
        ticks: [Number(currentTick-10n*tickSpacing), Number(currentTick+10n*tickSpacing)],
        amountsToFarm: [amountDesired, amountDesired],
        createIncentiveResult: createIncentiveResultEternal,
      });

      const liquidityUser0 = await helpers.nft.connect(lpUser0).positions(mintLPUser0.tokenId);
      const liquidityUser1 = await helpers.nft.connect(lpUser1).positions(mintLPUser1.tokenId);
      const liquidityUser2 = await helpers.nft.connect(lpUser2).positions(mintLPUser2.tokenId);
      
      const farmdAtUser0 = BigInt(mintLPUser0.farmdAt);
      const farmdAtUser1 = BigInt(mintLPUser1.farmdAt);
      const farmdAtUser2 = BigInt(mintLPUser2.farmdAt);

      const timestampAfter = await blockTimestamp();
      const checkTime = timestampAfter + 100;
      await Time.setAndMine(checkTime);
      
      const rewardInfoUser0Before = await context.eternalFarming.getRewardInfo(
        incentiveKey,
        mintLPUser0.tokenId);
      const rewardInfoUser1Before = await context.eternalFarming.getRewardInfo(
        incentiveKey,
        mintLPUser1.tokenId);
      const rewardInfoUser2Before = await context.eternalFarming.getRewardInfo(
        incentiveKey,
        mintLPUser2.tokenId);

      console.log('\n--- Actual rewards ---');
      console.log('User0 reward before:', rewardInfoUser0Before.reward.toString());
      console.log('User1 reward before:', rewardInfoUser1Before.reward.toString());
      console.log('User2 reward before:', rewardInfoUser2Before.reward.toString());

      
     
    // await context.eternalFarming.connect(lpUser0).exitFarming(
    //     incentiveKey,
    //     mintLPUser0.tokenId,
    //     lpUser0.address
    //   );

      
      await context.farmingCenter.connect(lpUser0).exitFarming(
        incentiveKey,
        mintLPUser0.tokenId
      );
      

      await helpers.makeTickGoFlow({
        trader: lpUser0,
        direction: 'up',
        desiredValue: 1,
      });

      expect(await context.farmingCenter.connect(lpUser0).enterFarming(incentiveKey, mintLPUser0.tokenId)).not.to.be.reverted;

      const rewardInfoUser0AfterExit  = await context.eternalFarming.getRewardInfo(
        incentiveKey,
        mintLPUser0.tokenId);
      
      console.log('User0 reward after exit:', rewardInfoUser0AfterExit.reward.toString());

      await Time.setAndMine(await blockTimestamp() + 100);


      // const rewardInfoUser0After = await context.eternalFarming.getRewardInfo(
      //   incentiveKey,
      //   mintLPUser0.tokenId);
      const rewardInfoUser1After = await context.eternalFarming.getRewardInfo(
        incentiveKey,
        mintLPUser1.tokenId);
      const rewardInfoUser2After = await context.eternalFarming.getRewardInfo(
        incentiveKey,
        mintLPUser2.tokenId);

        console.log('\n--- Actual rewards after swap ---');
        // console.log('User0 reward after:', rewardInfoUser0After.reward.toString());
        console.log('User1 reward after:', rewardInfoUser1After.reward.toString());
        console.log('User2 reward after:', rewardInfoUser2After.reward.toString());

        //expect(rewardInfoUser0After.reward).to.be.gt(rewardInfoUser0Before.reward);
        // expect(rewardInfoUser1After.reward).to.be.gt(rewardInfoUser1Before.reward);
        // expect(rewardInfoUser2After.reward).to.be.gt(rewardInfoUser2Before.reward);
      
    })
  });
});
