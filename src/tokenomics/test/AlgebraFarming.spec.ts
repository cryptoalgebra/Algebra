import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers'
import { TestContext } from './types'
import { AlgebraEternalFarming, TestERC20 } from '../typechain'
import { ethers } from 'hardhat'
import {
  BigNumber,
  blockTimestamp,
  BN,
  BNe18,
  expect,
  FeeAmount,
  getMaxTick,
  getMinTick,
  TICK_SPACINGS,
  algebraFixture,
  log,
  days,
  ratioE18,
  bnSum,
  getCurrentTick,
  BNe,
  mintPosition,
  MaxUint256,
  maxGas,
  encodePath,
} from './shared'
import { createTimeMachine } from './shared/time'
import { ERC20Helper, HelperCommands, incentiveResultToFarmAdapter } from './helpers'
import { provider } from './shared/provider'
import { ActorFixture } from './shared/actors'
import { HelperTypes } from './helpers/types'
import { Wallet } from 'ethers'

import './matchers/beWithin'
const LIMIT_FARMING = true
const ETERNAL_FARMING = false

describe('AlgebraFarming', () => {
  let wallets: Wallet[]
  const Time = createTimeMachine(provider)
  let actors: ActorFixture
  const e20h = new ERC20Helper()

  before(async () => {
    wallets = (await (ethers.getSigners() as any)) as Wallet[]
    actors = new ActorFixture(wallets, provider)
  })
  describe('minimal position width', async () => {
    type TestSubject = {
      helpers: HelperCommands
      context: TestContext
    }
    let subject: TestSubject

    const ticksToFarm: [number, number] = [getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]), getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])]
    const amountsToFarm: [BigNumber, BigNumber] = [BigNumber.from(100000), BNe18(10)]

    const totalReward = BNe18(2_000_000)
    const bonusReward = BNe18(4_000)
    const duration = days(40)

    const scenario: () => Promise<TestSubject> = async () => {
      const context = await algebraFixture()
      const wallets = (await ethers.getSigners()) as any as Wallet[]
      const helpers = HelperCommands.fromTestContext(context, new ActorFixture(wallets, ethers.provider), ethers.provider)

      const epoch = await blockTimestamp()
      const startTime = epoch + 100
      const endTime = startTime + duration

      return {
        context,
        helpers,
      }
    }

    beforeEach('load Fixture', async () => {
      subject = await loadFixture(scenario)
    })

    it('too wide range cannot be used as minimal allowed', async () => {
      const { context, helpers } = subject

      const lpUser3 = actors.traderUser2()

      // The non-staking user will deposit 25x the liquidity as the others
      const balanceDeposited = amountsToFarm[0]

      // Someone starts staking
      await e20h.ensureBalancesAndApprovals(lpUser3, [context.token0, context.token1], balanceDeposited, context.nft.address)

      const tokenId = await mintPosition(context.nft.connect(lpUser3), {
        token0: context.token0.address,
        token1: context.token1.address,
        fee: FeeAmount.MEDIUM,
        tickLower: ticksToFarm[0],
        tickUpper: ticksToFarm[0] + TICK_SPACINGS[FeeAmount.MEDIUM],
        recipient: lpUser3.address,
        amount0Desired: 0,
        amount1Desired: balanceDeposited,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 10000,
      })

      await context.nft.connect(lpUser3).approveForFarming(tokenId, true)

      const epoch = await blockTimestamp()
      const startTime = epoch + 100
      const endTime = startTime + duration

      let incentiveCreator = actors.incentiveCreator()

      await context.rewardToken.transfer(incentiveCreator.address, totalReward)
      await context.bonusRewardToken.transfer(incentiveCreator.address, bonusReward)
      await context.rewardToken.connect(incentiveCreator).approve(context.eternalFarming.address, totalReward)
      await context.bonusRewardToken.connect(incentiveCreator).approve(context.eternalFarming.address, bonusReward)

      await expect(
        (context.eternalFarming as AlgebraEternalFarming).connect(incentiveCreator).createEternalFarming(
          {
            pool: context.pool01,
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            startTime,
            endTime,
          },
          {
            reward: totalReward,
            bonusReward: bonusReward,
            rewardRate: 10,
            bonusRewardRate: 10,
            minimalPositionWidth: 2 ** 23 - 1 + 2 ** 23 - 1,
          }
        )
      ).to.be.revertedWithCustomError(context.eternalFarming as AlgebraEternalFarming, 'minimalPositionWidthTooWide')
      

      await expect(
        (context.eternalFarming as AlgebraEternalFarming).connect(incentiveCreator).createEternalFarming(
          {
            pool: context.pool01,
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            startTime,
            endTime,
          },
          {
            reward: totalReward,
            bonusReward: bonusReward,
            rewardRate: 10,
            bonusRewardRate: 10,
            minimalPositionWidth: 887272 * 2 + 1,
          }
        )
      ).to.be.revertedWithCustomError(context.eternalFarming as AlgebraEternalFarming, 'minimalPositionWidthTooWide')


      await expect(
        (context.eternalFarming as AlgebraEternalFarming).connect(incentiveCreator).createEternalFarming(
          {
            pool: context.pool01,
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            startTime,
            endTime,
          },
          {
            reward: totalReward,
            bonusReward: bonusReward,
            rewardRate: 10,
            bonusRewardRate: 10,
            minimalPositionWidth: (887272 - (887272 % 60)) * 2,
          }
        )
      ).to.be.not.reverted
    })

    it('max range can be used as minimal allowed', async () => {
      const { context, helpers } = subject

      const lpUser3 = actors.traderUser2()

      // The non-staking user will deposit 25x the liquidity as the others
      const balanceDeposited = amountsToFarm[0]

      // Someone starts staking
      await e20h.ensureBalancesAndApprovals(lpUser3, [context.token0, context.token1], balanceDeposited.mul(2), context.nft.address)

      const tokenId = await mintPosition(context.nft.connect(lpUser3), {
        token0: context.token0.address,
        token1: context.token1.address,
        fee: FeeAmount.MEDIUM,
        tickLower: ticksToFarm[0],
        tickUpper: ticksToFarm[0] + TICK_SPACINGS[FeeAmount.MEDIUM],
        recipient: lpUser3.address,
        amount0Desired: 0,
        amount1Desired: balanceDeposited,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 10000,
      })

      const tokenIdCorrect = await mintPosition(context.nft.connect(lpUser3), {
        token0: context.token0.address,
        token1: context.token1.address,
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: lpUser3.address,
        amount0Desired: balanceDeposited,
        amount1Desired: balanceDeposited,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 10000,
      })

      await context.nft.connect(lpUser3).approveForFarming(tokenId, true)
      await context.nft.connect(lpUser3).approveForFarming(tokenIdCorrect, true)

      const epoch = await blockTimestamp()
      const startTime = epoch + 100
      const endTime = startTime + duration
      const createIncentiveResult = await helpers.createIncentiveFlow({
        startTime,
        endTime,
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        minimalPositionWidth: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]) - getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        poolAddress: context.pool01,
        totalReward,
        bonusReward,
      })

      await expect(
        context.farmingCenter.connect(lpUser3).enterFarming(incentiveResultToFarmAdapter(createIncentiveResult), tokenId)
      ).to.be.revertedWithCustomError(context.eternalFarming as AlgebraEternalFarming, 'positionIsTooNarrow')

      await expect(
        context.farmingCenter.connect(lpUser3).enterFarming(incentiveResultToFarmAdapter(createIncentiveResult), tokenIdCorrect)
      ).to.be.not.reverted
    })
  })

  describe('there are three LPs in the same range', async () => {
    type TestSubject = {
      farms: Array<HelperTypes.MintDepositFarm.Result>
      createIncentiveResult: HelperTypes.CreateIncentive.Result
      helpers: HelperCommands
      context: TestContext
    }
    let subject: TestSubject

    const totalReward = BNe18(3_000)
    const bonusReward = BNe18(4_000)
    const duration = days(1)
    const ticksToFarm: [number, number] = [getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]), getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])]
    const amountsToFarm: [BigNumber, BigNumber] = [BNe18(1), BNe18(1)]

    const scenario: () => Promise<TestSubject> = async () => {
      const context = await algebraFixture()

      const epoch = await blockTimestamp()

      const {
        tokens: [token0, token1, rewardToken, bonusRewardToken],
      } = context
      const helpers = HelperCommands.fromTestContext(context, actors, provider)

      const tokensToFarm: [TestERC20, TestERC20] = [token0, token1]

      const startTime = epoch + 1_000
      const endTime = startTime + duration

      const createIncentiveResult = await helpers.createIncentiveFlow({
        startTime,
        endTime,
        rewardToken,
        bonusRewardToken,
        poolAddress: context.pool01,
        totalReward,
        bonusReward,
      })

      const params = {
        tokensToFarm,
        amountsToFarm,
        createIncentiveResult,
        ticks: ticksToFarm,
      }

      const farms = await Promise.all(
        actors.lpUsers().map((lp) =>
          helpers.mintDepositFarmFlow({
            ...params,
            lp,
          })
        )
      )
      await time.setNextBlockTimestamp(startTime + 1)

      const trader = actors.traderUser0()
      await helpers.makeTickGoFlow({
        trader,
        direction: 'up',
        desiredValue: 10,
      })

      return {
        context,
        farms,
        helpers,
        createIncentiveResult,
      }
    }

    beforeEach('load fixture', async () => {
      subject = await loadFixture(scenario)
    })

    describe('who all farm the entire time ', () => {
      it('allows them all to withdraw at the end', async () => {
        const { helpers, createIncentiveResult } = subject

        await time.increaseTo(createIncentiveResult.endTime + 1)

        const trader = actors.traderUser0()
        await helpers.makeTickGoFlow({
          trader,
          direction: 'up',
          desiredValue: 20,
        })

        // Sanity check: make sure we go past the incentive end time.
        expect(await blockTimestamp(), 'test setup: must be run after start time').to.be.gte(createIncentiveResult.endTime)

        // Everyone pulls their liquidity at the same time
        const exitFarmings = await Promise.all(
          subject.farms.map(({ lp, tokenId }) =>
            helpers.exitFarmingCollectBurnFlow({
              lp,
              tokenId,
              createIncentiveResult,
            })
          )
        )

        const rewardsEarned = bnSum(exitFarmings.map((o) => o.balance))
        log.debug('Total rewards ', rewardsEarned.toString())

        // const { amountReturnedToCreator } = await helpers.endIncentiveFlow({
        // 	createIncentiveResult,
        // })
        expect(rewardsEarned).to.be.gte(totalReward.mul(BN(9999)).div(BN(10000)))
      })
    })

    describe('who all farm the entire time ', () => {
      it('allows them all to withdraw at the end', async () => {
        const { helpers, createIncentiveResult } = subject

        await time.increaseTo(createIncentiveResult.endTime + 1)

        const trader = actors.traderUser0()
        await helpers.makeTickGoFlow({
          trader,
          direction: 'up',
          desiredValue: 20,
        })

        // Sanity check: make sure we go past the incentive end time.
        expect(await blockTimestamp(), 'test setup: must be run after start time').to.be.gte(createIncentiveResult.endTime)

        // Everyone pulls their liquidity at the same time
        const exitFarmings = await Promise.all(
          subject.farms.map(({ lp, tokenId }) =>
            helpers.exitFarmingCollectBurnFlow({
              lp,
              tokenId,
              createIncentiveResult,
            })
          )
        )

        const rewardsEarned = bnSum(exitFarmings.map((o) => o.balance))
        log.debug('Total rewards ', rewardsEarned.toString())

        // const { amountReturnedToCreator } = await helpers.endIncentiveFlow({
        // 	createIncentiveResult,
        // })
        expect(rewardsEarned).to.be.gte(totalReward.mul(BN(9999)).div(BN(10000)))
      })
    })

    describe('when another LP adds liquidity but does not farm', () => {
      it('does not change the rewards', async () => {
        const { helpers, createIncentiveResult, context, farms } = subject

        // Go halfway through
        await time.setNextBlockTimestamp(createIncentiveResult.startTime + duration / 2)

        const lpUser3 = actors.traderUser2()

        // The non-staking user will deposit 25x the liquidity as the others
        const balanceDeposited = amountsToFarm[0]

        // Someone starts staking
        await e20h.ensureBalancesAndApprovals(lpUser3, [context.token0, context.token1], balanceDeposited, context.nft.address)

        await mintPosition(context.nft.connect(lpUser3), {
          token0: context.token0.address,
          token1: context.token1.address,
          fee: FeeAmount.MEDIUM,
          tickLower: ticksToFarm[0],
          tickUpper: ticksToFarm[1],
          recipient: lpUser3.address,
          amount0Desired: balanceDeposited,
          amount1Desired: balanceDeposited,
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 1000,
        })

        await time.setNextBlockTimestamp(createIncentiveResult.endTime + 1)

        const trader = actors.traderUser0()
        await helpers.makeTickGoFlow({
          trader,
          direction: 'up',
          desiredValue: 20,
        })

        const exitFarmings = await Promise.all(
          farms.map(({ lp, tokenId }) =>
            helpers.exitFarmingCollectBurnFlow({
              lp,
              tokenId,
              createIncentiveResult,
            })
          )
        )

        /***
         * The reward distributed to LPs should be:
         *
         * totalReward: is 3_000e18
         *
         * Incentive Start -> Halfway Through:
         * 3 LPs, all staking the same amount. Each LP gets roughly (totalReward/2) * (1/3)
         */
        const firstHalfRewards = totalReward.div(BN('2'))

        /***
         * Halfway Through -> Incentive End:
         * 4 LPs, all providing the same liquidity. Only 3 LPs are staking, so they should
         * each get 1/4 the liquidity for that time. So That's 1/4 * 1/2 * 3_000e18 per farmd LP.
         * */
        const secondHalfRewards = totalReward.div(BN('2')).mul('3').div('4')
        const rewardsEarned = bnSum(exitFarmings.map((s) => s.balance))
        // @ts-ignore
        expect(rewardsEarned).be.gte(totalReward.mul(BN(9999)).div(BN(10000)))
        // const { amountReturnedToCreator } = await helpers.endIncentiveFlow({
        // 	createIncentiveResult,
        // })
      })
    })
  })

})