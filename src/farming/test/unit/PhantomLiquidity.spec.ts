import { ethers } from 'hardhat';
import { Wallet } from 'ethers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { AlgebraEternalFarming } from '../../typechain';
import { mintPosition, AlgebraFixtureType, algebraFixture } from '../shared/fixtures';
import { expect, getMaxTick, getMinTick, FeeAmount, TICK_SPACINGS, blockTimestamp, BNe18, ActorFixture, ZERO_ADDRESS } from '../shared';
import { provider } from '../shared/provider';
import { HelperCommands, ERC20Helper } from '../helpers';
import { HelperTypes } from '../helpers/types';
import { createTimeMachine } from '../shared/time';
import { ContractParams } from '../../types/contractParams';

/**
 * Covers the anti-JIT farming buffer / phantom-liquidity mitigation: the liquidity-weighted
 * vesting timestamp blend, the buffer/forfeiture bucket, and the dodge/shell/griefing scenarios
 * from src/farming/phantom-liquidity-design.md.
 */
describe('unit/PhantomLiquidity', () => {
  let actors: ActorFixture;
  let admin: Wallet;
  let lpUser0: Wallet;
  let attacker: Wallet;
  const erc20Helper = new ERC20Helper();
  const Time = createTimeMachine();
  let helpers: HelperCommands;
  let context: AlgebraFixtureType;

  const BUFFER = 1_000; // seconds

  before(async () => {
    const wallets = (await ethers.getSigners()) as any as Wallet[];
    actors = new ActorFixture(wallets, provider);
    admin = actors.wallets[0];
    lpUser0 = actors.lpUser0();
    attacker = actors.lpUser1();
  });

  beforeEach('load fixture', async () => {
    context = await loadFixture(algebraFixture);
    helpers = HelperCommands.fromTestContext(context, actors, provider);
  });

  // Shared setup: a big eternal farming incentive with the default buffer set to BUFFER seconds.
  const setUpIncentive = async (): Promise<{
    localNonce: bigint;
    createIncentiveResult: HelperTypes.CreateIncentive.Result;
    farmIncentiveKey: ContractParams.IncentiveKey;
    incentiveId: string;
  }> => {
    await context.eternalFarming.connect(admin).setFarmingBuffer(ZERO_ADDRESS, BUFFER);

    const localNonce = await context.eternalFarming.numOfIncentives();

    const createIncentiveResult = await helpers.createIncentiveFlow({
      rewardToken: context.rewardToken,
      bonusRewardToken: context.bonusRewardToken,
      totalReward: 10_000_000n,
      bonusReward: 5_000_000n,
      poolAddress: await context.poolObj.getAddress(),
      nonce: localNonce,
      rewardRate: 50n,
      bonusRewardRate: 25n,
    });

    const farmIncentiveKey: ContractParams.IncentiveKey = {
      pool: context.pool01,
      rewardToken: await context.rewardToken.getAddress(),
      bonusRewardToken: await context.bonusRewardToken.getAddress(),
      nonce: localNonce,
    };

    const incentiveId = await helpers.getIncentiveId(createIncentiveResult);

    return { localNonce, createIncentiveResult, farmIncentiveKey, incentiveId };
  };

  const fullRangeTicks: [number, number] = [getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]), getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])];

  describe('#antiJitBuffer', () => {
    let farmIncentiveKey: ContractParams.IncentiveKey;
    let incentiveId: string;
    let createIncentiveResult: HelperTypes.CreateIncentive.Result;

    beforeEach(async () => {
      ({ createIncentiveResult, farmIncentiveKey, incentiveId } = await setUpIncentive());
    });

    it('pays reward normally once the buffer has elapsed', async () => {
      const mintResult = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm: [context.token0, context.token1],
        ticks: fullRangeTicks,
        amountsToFarm: [BNe18(10), BNe18(10)],
        createIncentiveResult,
      });

      await Time.setAndMine((await blockTimestamp()) + BUFFER + 10);

      await expect(context.farmingCenter.connect(lpUser0).collectRewards(farmIncentiveKey, mintResult.tokenId))
        .to.emit(context.eternalFarming, 'RewardsCollected')
        .and.to.not.emit(context.eternalFarming, 'RewardsForfeited');

      expect(await context.eternalFarming.rewards(lpUser0.address, context.rewardToken)).to.be.gt(0);
      expect(await context.eternalFarming.rewards(ZERO_ADDRESS, context.rewardToken)).to.eq(0);
    });

    it('forfeits reward collected while still inside the buffer', async () => {
      const mintResult = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm: [context.token0, context.token1],
        ticks: fullRangeTicks,
        amountsToFarm: [BNe18(10), BNe18(10)],
        createIncentiveResult,
      });

      await Time.setAndMine((await blockTimestamp()) + BUFFER / 2);

      await expect(context.farmingCenter.connect(lpUser0).collectRewards(farmIncentiveKey, mintResult.tokenId))
        .to.emit(context.eternalFarming, 'RewardsForfeited')
        .and.to.not.emit(context.eternalFarming, 'RewardsCollected');

      expect(await context.eternalFarming.rewards(lpUser0.address, context.rewardToken)).to.eq(0);
      expect(await context.eternalFarming.rewards(ZERO_ADDRESS, context.rewardToken)).to.be.gt(0);
    });

    it('a small top-up on an already-vested position stays safe', async () => {
      const mintResult = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm: [context.token0, context.token1],
        ticks: fullRangeTicks,
        amountsToFarm: [BNe18(1_000), BNe18(1_000)],
        createIncentiveResult,
      });
      const tokenId = mintResult.tokenId;

      // let the position clear the buffer first (e.g. an established LP), THEN top up with dust
      // (an auto-compounder reinvesting fees, or the owner just adding a bit more)
      await Time.setAndMine((await blockTimestamp()) + BUFFER + 100);

      await erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.token0, context.token1], 1_000n, await context.nft.getAddress());
      await expect(
        context.nft.connect(lpUser0).increaseLiquidity({
          tokenId,
          amount0Desired: 1_000n,
          amount1Desired: 1_000n,
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 1_000,
        })
      ).to.not.emit(context.eternalFarming, 'RewardsForfeited'); // the top-up itself doesn't forfeit the already-vested history

      // an immediate collect right after is also safe: the dust top-up barely moved the blended vesting timestamp
      await expect(context.farmingCenter.connect(lpUser0).collectRewards(farmIncentiveKey, tokenId))
        .to.emit(context.eternalFarming, 'RewardsCollected')
        .and.to.not.emit(context.eternalFarming, 'RewardsForfeited');
    });

    it('a top-up before the position clears its own buffer still forfeits the reward accrued so far (accepted limitation)', async () => {
      // any liquidity change forces a checkpoint, so a top-up made while still inside the buffer is
      // judged exactly like an explicit collectRewards call would be at that same moment. The blend
      // above only protects top-ups on an already-vested position, not this immediate settlement.
      const mintResult = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm: [context.token0, context.token1],
        ticks: fullRangeTicks,
        amountsToFarm: [BNe18(1_000), BNe18(1_000)],
        createIncentiveResult,
      });
      const tokenId = mintResult.tokenId;

      // still well inside the buffer
      await Time.setAndMine((await blockTimestamp()) + BUFFER / 2);

      await erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.token0, context.token1], 1_000n, await context.nft.getAddress());
      await expect(
        context.nft.connect(lpUser0).increaseLiquidity({
          tokenId,
          amount0Desired: 1_000n,
          amount1Desired: 1_000n,
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 1_000,
        })
      ).to.emit(context.eternalFarming, 'RewardsForfeited');
    });

    it('decreaseLiquidity never moves the vesting timestamp', async () => {
      const mintResult = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm: [context.token0, context.token1],
        ticks: fullRangeTicks,
        amountsToFarm: [BNe18(10), BNe18(10)],
        createIncentiveResult,
      });
      const tokenId = mintResult.tokenId;

      const farmBefore = await context.eternalFarming.farms(tokenId, incentiveId);

      await Time.setAndMine((await blockTimestamp()) + 100);

      const liquidity = (await context.nft.positions(tokenId)).liquidity;
      await context.nft.connect(lpUser0).decreaseLiquidity({
        tokenId,
        liquidity: liquidity / 4n,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 1_000,
      });

      const farmAfter = await context.eternalFarming.farms(tokenId, incentiveId);
      expect(farmAfter.enteredTimestamp).to.eq(farmBefore.enteredTimestamp);
    });
  });

  describe('#phantomLiquidityDodge', () => {
    let farmIncentiveKey: ContractParams.IncentiveKey;
    let createIncentiveResult: HelperTypes.CreateIncentive.Result;
    let tokenId: string;

    beforeEach(async () => {
      ({ createIncentiveResult, farmIncentiveKey } = await setUpIncentive());

      const mintResult = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm: [context.token0, context.token1],
        ticks: fullRangeTicks,
        amountsToFarm: [BNe18(100), BNe18(100)],
        createIncentiveResult,
      });
      tokenId = mintResult.tokenId;

      // position genuinely vests well past the buffer before the dodge attempt
      await Time.setAndMine((await blockTimestamp()) + BUFFER + 500);
    });

    it('draining to dust then reinflating right before a claim re-vests the reinjected liquidity', async () => {
      const fullLiquidity = (await context.nft.positions(tokenId)).liquidity;

      // dodge step 1: drain to ~0.1% right before the price-moving swap/claim window
      await context.nft.connect(lpUser0).decreaseLiquidity({
        tokenId,
        liquidity: fullLiquidity - fullLiquidity / 1_000n,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 1_000,
      });

      // dodge step 2: reinflate back to the original size right after
      await erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.token0, context.token1], BNe18(100), await context.nft.getAddress());
      await context.nft.connect(lpUser0).increaseLiquidity({
        tokenId,
        amount0Desired: BNe18(100),
        amount1Desired: BNe18(100),
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 1_000,
      });

      // an immediate claim right after reinflating is (mostly) forfeited: the huge reinjection relative
      // to the dust remainder pulls the blended vesting timestamp back close to "now"
      await expect(context.farmingCenter.connect(lpUser0).collectRewards(farmIncentiveKey, tokenId)).to.emit(
        context.eternalFarming,
        'RewardsForfeited'
      );
    });

    it('rewards become safe again only after waiting out a fresh buffer past the reinflation', async () => {
      const fullLiquidity = (await context.nft.positions(tokenId)).liquidity;

      await context.nft.connect(lpUser0).decreaseLiquidity({
        tokenId,
        liquidity: fullLiquidity - fullLiquidity / 1_000n,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 1_000,
      });

      await erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.token0, context.token1], BNe18(100), await context.nft.getAddress());
      await context.nft.connect(lpUser0).increaseLiquidity({
        tokenId,
        amount0Desired: BNe18(100),
        amount1Desired: BNe18(100),
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 1_000,
      });

      await Time.setAndMine((await blockTimestamp()) + BUFFER + 10);

      await expect(context.farmingCenter.connect(lpUser0).collectRewards(farmIncentiveKey, tokenId))
        .to.emit(context.eternalFarming, 'RewardsCollected')
        .and.to.not.emit(context.eternalFarming, 'RewardsForfeited');
    });

    it('cannot dodge repeatedly without eating a fresh buffer window each time', async () => {
      const cycle = async () => {
        const liquidity = (await context.nft.positions(tokenId)).liquidity;
        await context.nft.connect(lpUser0).decreaseLiquidity({
          tokenId,
          liquidity: liquidity - liquidity / 1_000n,
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 1_000,
        });
        await erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.token0, context.token1], BNe18(100), await context.nft.getAddress());
        await context.nft.connect(lpUser0).increaseLiquidity({
          tokenId,
          amount0Desired: BNe18(100),
          amount1Desired: BNe18(100),
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 1_000,
        });
      };

      // three dodge cycles in a row, each immediately followed by a claim attempt
      for (let i = 0; i < 3; i++) {
        await cycle();
        await expect(context.farmingCenter.connect(lpUser0).collectRewards(farmIncentiveKey, tokenId)).to.emit(
          context.eternalFarming,
          'RewardsForfeited'
        );
      }
    });
  });

  describe('#shellFarmLaundering', () => {
    let farmIncentiveKey: ContractParams.IncentiveKey;
    let incentiveId: string;

    beforeEach(async () => {
      ({ farmIncentiveKey, incentiveId } = await setUpIncentive());
    });

    it('a minimal shell that individually waited out the buffer still forfeits after a large top-up', async () => {
      await erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.token0, context.token1], 1_000n, await context.nft.getAddress());

      const tokenId = await mintPosition(context.nft.connect(lpUser0), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: fullRangeTicks[0],
        tickUpper: fullRangeTicks[1],
        recipient: lpUser0.address,
        amount0Desired: 1_000n,
        amount1Desired: 1_000n,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 1_000,
      });

      await context.nft.connect(lpUser0).approveForFarming(tokenId, true, context.farmingCenter);
      await context.farmingCenter.connect(lpUser0).enterFarming(farmIncentiveKey, tokenId);

      // the shell itself individually clears the buffer
      await Time.setAndMine((await blockTimestamp()) + BUFFER + 10);

      // ... then gets inflated to a realistic farming size right before use
      await erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.token0, context.token1], BNe18(1_000), await context.nft.getAddress());
      await context.nft.connect(lpUser0).increaseLiquidity({
        tokenId,
        amount0Desired: BNe18(1_000),
        amount1Desired: BNe18(1_000),
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 1_000,
      });

      await expect(context.farmingCenter.connect(lpUser0).collectRewards(farmIncentiveKey, tokenId)).to.emit(
        context.eternalFarming,
        'RewardsForfeited'
      );

      const farm = await context.eternalFarming.farms(tokenId, incentiveId);
      const now = await blockTimestamp();
      // the vesting timestamp got pulled close to "now" despite the shell having individually vested
      expect(Number(farm.enteredTimestamp)).to.be.closeTo(now, 5);
    });

    it('repeated doubling converges the vesting timestamp toward "now" regardless of chunking', async () => {
      const STEP = 200;
      const DOUBLINGS = 10;

      await erc20Helper.ensureBalancesAndApprovals(
        lpUser0,
        [context.token0, context.token1],
        BNe18(10) * 2n ** BigInt(DOUBLINGS + 1),
        await context.nft.getAddress()
      );

      const tokenId = await mintPosition(context.nft.connect(lpUser0), {
        token0: await context.token0.getAddress(),
        token1: await context.token1.getAddress(),
        fee: FeeAmount.MEDIUM,
        tickLower: fullRangeTicks[0],
        tickUpper: fullRangeTicks[1],
        recipient: lpUser0.address,
        amount0Desired: 1_000n,
        amount1Desired: 1_000n,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 1_000,
      });

      await context.nft.connect(lpUser0).approveForFarming(tokenId, true, context.farmingCenter);

      let t = (await blockTimestamp()) + STEP;
      await Time.set(t);
      await context.farmingCenter.connect(lpUser0).enterFarming(farmIncentiveKey, tokenId);

      let expectedTs = BigInt(t);
      let prevLiquidity = (await context.nft.positions(tokenId)).liquidity;

      for (let i = 0; i < DOUBLINGS; i++) {
        t += STEP;
        await Time.set(t);

        await context.nft.connect(lpUser0).increaseLiquidity({
          tokenId,
          amount0Desired: prevLiquidity,
          amount1Desired: prevLiquidity,
          amount0Min: 0,
          amount1Min: 0,
          deadline: t + 1_000,
        });

        const currentLiquidity = (await context.nft.positions(tokenId)).liquidity;
        const addedLiquidity = currentLiquidity - prevLiquidity;

        expectedTs = (expectedTs * prevLiquidity + BigInt(t) * addedLiquidity) / currentLiquidity;

        const farm = await context.eternalFarming.farms(tokenId, incentiveId);
        expect(Number(farm.enteredTimestamp)).to.be.closeTo(Number(expectedTs), 1);

        prevLiquidity = currentLiquidity;
      }

      // after ~10 doublings, the origin (200s before the first doubling) should be all but forgotten
      expect(Number((await context.eternalFarming.farms(tokenId, incentiveId)).enteredTimestamp)).to.be.closeTo(t, STEP);
    });
  });

  describe('#forfeitedRewardsBucket and admin', () => {
    let farmIncentiveKey: ContractParams.IncentiveKey;
    let createIncentiveResult: HelperTypes.CreateIncentive.Result;

    beforeEach(async () => {
      ({ createIncentiveResult, farmIncentiveKey } = await setUpIncentive());

      const mintResult = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm: [context.token0, context.token1],
        ticks: fullRangeTicks,
        amountsToFarm: [BNe18(10), BNe18(10)],
        createIncentiveResult,
      });

      // collect inside the buffer so something lands in the forfeited bucket
      await Time.setAndMine((await blockTimestamp()) + BUFFER / 2);
      await context.farmingCenter.connect(lpUser0).collectRewards(farmIncentiveKey, mintResult.tokenId);
    });

    it('forfeited rewards accrue under the zero address', async () => {
      expect(await context.eternalFarming.rewards(ZERO_ADDRESS, context.rewardToken)).to.be.gt(0);
    });

    it('withdrawForfeitedRewards only incentive maker', async () => {
      expect(context.eternalFarming.connect(lpUser0).withdrawForfeitedRewards(context.rewardToken, lpUser0.address, 0)).to.be
        .revertedWithoutReason;
    });

    it('withdrawForfeitedRewards transfers the bucket and emits an event', async () => {
      const bucket = await context.eternalFarming.rewards(ZERO_ADDRESS, context.rewardToken);
      const balanceBefore = await context.rewardToken.balanceOf(admin.address);

      await expect(context.eternalFarming.connect(admin).withdrawForfeitedRewards(context.rewardToken, admin.address, 0))
        .to.emit(context.eternalFarming, 'ForfeitedRewardsWithdrawn')
        .withArgs(await context.rewardToken.getAddress(), admin.address, bucket);

      expect(await context.rewardToken.balanceOf(admin.address)).to.eq(balanceBefore + bucket);
      expect(await context.eternalFarming.rewards(ZERO_ADDRESS, context.rewardToken)).to.eq(0);
    });

    it('withdrawForfeitedRewards caps an excessive request at the bucket balance', async () => {
      const bucket = await context.eternalFarming.rewards(ZERO_ADDRESS, context.rewardToken);

      await context.eternalFarming.connect(admin).withdrawForfeitedRewards(context.rewardToken, admin.address, bucket * 100n);

      expect(await context.eternalFarming.rewards(ZERO_ADDRESS, context.rewardToken)).to.eq(0);
    });

  });

  describe('#setFarmingBuffer', () => {
    it('only administrator', async () => {
      expect(context.eternalFarming.connect(lpUser0).setFarmingBuffer(ZERO_ADDRESS, 100)).to.be.revertedWithoutReason;
    });

    it('sets the global default when pool is the zero address', async () => {
      await context.eternalFarming.connect(admin).setFarmingBuffer(ZERO_ADDRESS, 500);
      expect(await context.eternalFarming.defaultFarmingBuffer()).to.eq(500);
    });

    it('sets a per-pool override independently of the default', async () => {
      await context.eternalFarming.connect(admin).setFarmingBuffer(ZERO_ADDRESS, 500);
      await context.eternalFarming.connect(admin).setFarmingBuffer(context.pool01, 2_000);

      expect(await context.eternalFarming.defaultFarmingBuffer()).to.eq(500);
      expect(await context.eternalFarming.poolFarmingBuffer(context.pool01)).to.eq(2_000);
    });

    it('reverts if the buffer exceeds 7 days', async () => {
      await expect(context.eternalFarming.connect(admin).setFarmingBuffer(ZERO_ADDRESS, 7 * 86_400 + 1)).to.be.revertedWithCustomError(
        context.eternalFarming as AlgebraEternalFarming,
        'farmingBufferTooLong'
      );
    });

    it('accepts exactly 7 days', async () => {
      await expect(context.eternalFarming.connect(admin).setFarmingBuffer(ZERO_ADDRESS, 7 * 86_400)).to.not.be.reverted;
    });

    it('emits PoolFarmingBuffer', async () => {
      await expect(context.eternalFarming.connect(admin).setFarmingBuffer(context.pool01, 42)).to.emit(context.eternalFarming, 'PoolFarmingBuffer')
        .withArgs(context.pool01, 42);
    });
  });

  describe('#bufferExemption', () => {
    let farmIncentiveKey: ContractParams.IncentiveKey;
    let createIncentiveResult: HelperTypes.CreateIncentive.Result;

    beforeEach(async () => {
      ({ createIncentiveResult, farmIncentiveKey } = await setUpIncentive());
    });

    it('only incentive maker', async () => {
      expect(context.eternalFarming.connect(lpUser0).setBufferExempt(lpUser0.address, true)).to.be.revertedWithoutReason;
    });

    it('factory owner can set it too', async () => {
      await expect(context.eternalFarming.connect(admin).setBufferExempt(lpUser0.address, true)).to.not.be.reverted;
      expect(await context.eternalFarming.isBufferExempt(lpUser0.address)).to.be.true;
    });

    it('emits BufferExemptionChanged', async () => {
      await expect(context.eternalFarming.connect(admin).setBufferExempt(lpUser0.address, true))
        .to.emit(context.eternalFarming, 'BufferExemptionChanged')
        .withArgs(lpUser0.address, true);
    });

    it('an exempt owner is never forfeited, even collecting right after entering', async () => {
      await context.eternalFarming.connect(admin).setBufferExempt(lpUser0.address, true);

      const mintResult = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm: [context.token0, context.token1],
        ticks: fullRangeTicks,
        amountsToFarm: [BNe18(10), BNe18(10)],
        createIncentiveResult,
      });

      // no time advance at all - deep inside the buffer for a non-exempt owner
      await expect(context.farmingCenter.connect(lpUser0).collectRewards(farmIncentiveKey, mintResult.tokenId))
        .to.emit(context.eternalFarming, 'RewardsCollected')
        .and.to.not.emit(context.eternalFarming, 'RewardsForfeited');
    });

    it('a non-exempt owner is still forfeited in the same scenario (control)', async () => {
      const mintResult = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm: [context.token0, context.token1],
        ticks: fullRangeTicks,
        amountsToFarm: [BNe18(10), BNe18(10)],
        createIncentiveResult,
      });

      await expect(context.farmingCenter.connect(lpUser0).collectRewards(farmIncentiveKey, mintResult.tokenId))
        .to.emit(context.eternalFarming, 'RewardsForfeited')
        .and.to.not.emit(context.eternalFarming, 'RewardsCollected');
    });

    it('an ALM-style rebalance (burn + mint a new tokenId) is not forfeited for an exempt owner', async () => {
      await context.eternalFarming.connect(admin).setBufferExempt(lpUser0.address, true);

      const mintResult = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm: [context.token0, context.token1],
        ticks: fullRangeTicks,
        amountsToFarm: [BNe18(10), BNe18(10)],
        createIncentiveResult,
      });

      // simulate a rebalance: exit the old (freshly-created) position entirely...
      await context.farmingCenter.connect(lpUser0).exitFarming(farmIncentiveKey, mintResult.tokenId);

      // ...and enter farming again with a brand-new tokenId (a real rebalance mints a new NFT
      // with different ticks; a fresh mint here is enough to exercise the same enterFarming(0, 0) path)
      const rebalanced = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm: [context.token0, context.token1],
        ticks: fullRangeTicks,
        amountsToFarm: [BNe18(10), BNe18(10)],
        createIncentiveResult,
      });

      await expect(context.farmingCenter.connect(lpUser0).collectRewards(farmIncentiveKey, rebalanced.tokenId))
        .to.emit(context.eternalFarming, 'RewardsCollected')
        .and.to.not.emit(context.eternalFarming, 'RewardsForfeited');
    });

    it('turning exemption back off makes forfeiture apply again', async () => {
      await context.eternalFarming.connect(admin).setBufferExempt(lpUser0.address, true);
      await context.eternalFarming.connect(admin).setBufferExempt(lpUser0.address, false);

      const mintResult = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm: [context.token0, context.token1],
        ticks: fullRangeTicks,
        amountsToFarm: [BNe18(10), BNe18(10)],
        createIncentiveResult,
      });

      await expect(context.farmingCenter.connect(lpUser0).collectRewards(farmIncentiveKey, mintResult.tokenId))
        .to.emit(context.eternalFarming, 'RewardsForfeited')
        .and.to.not.emit(context.eternalFarming, 'RewardsCollected');
    });
  });

  describe('#permissionlessInjectionGriefing', () => {
    let farmIncentiveKey: ContractParams.IncentiveKey;
    let createIncentiveResult: HelperTypes.CreateIncentive.Result;
    let tokenId: string;
    let t0: number;
    const AGE = 100_000; // >> BUFFER: victim position is long-since vested before the attack

    beforeEach(async () => {
      ({ createIncentiveResult, farmIncentiveKey } = await setUpIncentive());

      const mintResult = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm: [context.token0, context.token1],
        ticks: fullRangeTicks,
        amountsToFarm: [BNe18(1_000), BNe18(1_000)],
        createIncentiveResult,
      });
      tokenId = mintResult.tokenId;
      t0 = mintResult.farmdAt;

      await Time.setAndMine(t0 + AGE);
    });

    it('a dust injection into a long-vested victim position safely settles the historical reward', async () => {
      await erc20Helper.ensureBalancesAndApprovals(attacker, [context.token0, context.token1], 100n, await context.nft.getAddress());

      await expect(
        context.nft.connect(attacker).increaseLiquidity({
          tokenId,
          amount0Desired: 100n,
          amount1Desired: 100n,
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 1_000,
        })
      )
        .to.emit(context.eternalFarming, 'FarmEnded')
        .and.to.not.emit(context.eternalFarming, 'RewardsForfeited');

      // the whole history since entry is safely credited to the victim, not the attacker
      expect(await context.eternalFarming.rewards(lpUser0.address, context.rewardToken)).to.be.gt(0);
      expect(await context.eternalFarming.rewards(attacker.address, context.rewardToken)).to.eq(0);
      expect(await context.eternalFarming.rewards(ZERO_ADDRESS, context.rewardToken)).to.eq(0);
    });

    it('a cheap injection cannot push an established position back under the buffer', async () => {
      const L0 = (await context.nft.positions(tokenId)).liquidity;
      // Δ_min ~= L0 * (AGE - BUFFER) / BUFFER is roughly the capital needed to shift the vesting
      // timestamp back within the buffer window; use a comfortably smaller amount.
      const deltaMin = (L0 * BigInt(AGE - BUFFER)) / BigInt(BUFFER);
      const cheapDelta = deltaMin / 20n;

      await erc20Helper.ensureBalancesAndApprovals(attacker, [context.token0, context.token1], cheapDelta, await context.nft.getAddress());
      await context.nft.connect(attacker).increaseLiquidity({
        tokenId,
        amount0Desired: cheapDelta,
        amount1Desired: cheapDelta,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 1_000,
      });

      await expect(context.farmingCenter.connect(lpUser0).collectRewards(farmIncentiveKey, tokenId))
        .to.emit(context.eternalFarming, 'RewardsCollected')
        .and.to.not.emit(context.eternalFarming, 'RewardsForfeited');
    });

    it('an injection comparable to the position size does push future rewards back under the buffer', async () => {
      const L0 = (await context.nft.positions(tokenId)).liquidity;
      const deltaMin = (L0 * BigInt(AGE - BUFFER)) / BigInt(BUFFER);
      const largeDelta = deltaMin * 20n;

      await erc20Helper.ensureBalancesAndApprovals(attacker, [context.token0, context.token1], largeDelta, await context.nft.getAddress());
      await context.nft.connect(attacker).increaseLiquidity({
        tokenId,
        amount0Desired: largeDelta,
        amount1Desired: largeDelta,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 1_000,
      });

      // only the sliver accrued since the injection is at risk - the historical reward was already settled
      await expect(context.farmingCenter.connect(lpUser0).collectRewards(farmIncentiveKey, tokenId)).to.emit(
        context.eternalFarming,
        'RewardsForfeited'
      );
    });

    it('a dust injection into a still-vesting victim position forfeits its currently-accrued reward', async () => {
      // fresh position, still inside its own buffer
      const mintResult = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm: [context.token0, context.token1],
        ticks: fullRangeTicks,
        amountsToFarm: [BNe18(10), BNe18(10)],
        createIncentiveResult,
      });
      const freshTokenId = mintResult.tokenId;

      await Time.setAndMine((await blockTimestamp()) + BUFFER / 2);

      await erc20Helper.ensureBalancesAndApprovals(attacker, [context.token0, context.token1], 100n, await context.nft.getAddress());

      await expect(
        context.nft.connect(attacker).increaseLiquidity({
          tokenId: freshTokenId,
          amount0Desired: 100n,
          amount1Desired: 100n,
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 1_000,
        })
      ).to.emit(context.eternalFarming, 'RewardsForfeited');

      // nothing was credited to the victim for this still-vesting stretch - it all went to the bucket
      expect(await context.eternalFarming.rewards(lpUser0.address, context.rewardToken)).to.eq(0);
      expect(await context.eternalFarming.rewards(ZERO_ADDRESS, context.rewardToken)).to.be.gt(0);
    });
  });
});
