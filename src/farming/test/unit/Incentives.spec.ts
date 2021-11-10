import { LoadFixtureFunction } from '../types'
import { algebraFixture, AlgebraFixtureType } from '../shared/fixtures'
import {
  expect,
  getMaxTick,
  getMinTick,
  FeeAmount,
  TICK_SPACINGS,
  blockTimestamp,
  BN,
  BNe18,
  snapshotGasCost,
  ActorFixture,
  erc20Wrap,
  makeTimestamps,
} from '../shared'
import { createFixtureLoader, provider } from '../shared/provider'
import { HelperCommands, ERC20Helper } from '../helpers'
import { ContractParams } from '../../types/contractParams'
import { createTimeMachine } from '../shared/time'
import { HelperTypes } from '../helpers/types'

let loadFixture: LoadFixtureFunction

describe('unit/Incentives', async () => {
  const actors = new ActorFixture(provider.getWallets(), provider)
  const incentiveCreator = actors.incentiveCreator()
  const totalReward = BNe18(100)
  const bonusReward = BNe18(100)
  const erc20Helper = new ERC20Helper()
  const Time = createTimeMachine(provider)

  let helpers: HelperCommands
  let context: AlgebraFixtureType
  let timestamps: ContractParams.Timestamps

  before('loader', async () => {
    loadFixture = createFixtureLoader(provider.getWallets(), provider)
  })

  beforeEach('create fixture loader', async () => {
    context = await loadFixture(algebraFixture)
    helpers = HelperCommands.fromTestContext(context, actors, provider)
  })

  describe('#createIncentive', () => {
    let subject: (params: Partial<ContractParams.CreateIncentive>) => Promise<any>

    beforeEach('setup', async () => {
      subject = async (params: Partial<ContractParams.CreateIncentive> = {}) => {
        await erc20Helper.ensureBalancesAndApprovals(
          incentiveCreator,
          params.rewardToken ? await erc20Wrap(params?.rewardToken) : context.rewardToken,
          totalReward,
          context.farming.address
        )

        await erc20Helper.ensureBalancesAndApprovals(
          incentiveCreator,
          params.bonusRewardToken ? await erc20Wrap(params?.bonusRewardToken) : context.bonusRewardToken,
          bonusReward,
          context.farming.address
        )

        const { startTime, endTime } = makeTimestamps(await blockTimestamp())

        return await context.farming.connect(incentiveCreator).createIncentive(
          {
            rewardToken: params.rewardToken || context.rewardToken.address,
            bonusRewardToken: params.bonusRewardToken || context.bonusRewardToken.address,
            pool: context.pool01,
            startTime: params.startTime || startTime,
            endTime: params.endTime || endTime,
            refundee: params.refundee || incentiveCreator.address,
          },
          totalReward,
          bonusReward
        )
      }
    })

    describe('works and', () => {
      it('transfers the right amount of rewardToken', async () => {
        const balanceBefore = await context.rewardToken.balanceOf(context.farming.address)
        await subject({
          reward: totalReward,
          rewardToken: context.rewardToken.address,
        })

        expect(await context.rewardToken.balanceOf(context.farming.address)).to.eq(balanceBefore.add(totalReward))
      })

      it('creates an incentive with the correct parameters', async () => {
        timestamps = makeTimestamps(await blockTimestamp())
        await subject(timestamps)
        const incentiveId = await context.testIncentiveId.compute({
          rewardToken: context.rewardToken.address,
          bonusRewardToken: context.bonusRewardToken.address,
          pool: context.pool01,
          startTime: timestamps.startTime,
          endTime: timestamps.endTime,
          refundee: incentiveCreator.address,
        })

        const incentive = await context.farming.incentives(incentiveId)
      })

      it('adds to existing incentives', async () => {
        const params = makeTimestamps(await blockTimestamp())
        expect(await subject(params)).to.emit(context.farming, 'IncentiveCreated')
        await expect(subject(params)).to.be.revertedWith('AlgebraFarming::createIncentive: there is already active incentive');
        const incentiveId = await context.testIncentiveId.compute({
          rewardToken: context.rewardToken.address,
          bonusRewardToken: context.bonusRewardToken.address,
          pool: context.pool01,
          startTime: timestamps.startTime,
          endTime: timestamps.endTime,
          refundee: incentiveCreator.address,
        })
        const { numberOfFarms } = await context.farming.incentives(
          incentiveId
        )
        expect(numberOfFarms).to.equal(0)
      })

      it('does not override the existing numberOfFarms', async () => {
        const testTimestamps = makeTimestamps(await blockTimestamp() + 100)
        const rewardToken = context.token0
        const bonusRewardToken = context.token1
        const incentiveKey = {
          ...testTimestamps,
          rewardToken: rewardToken.address,
          bonusRewardToken: context.bonusRewardToken.address,
          refundee: incentiveCreator.address,
          pool: context.pool01,
        }
        await erc20Helper.ensureBalancesAndApprovals(actors.incentiveCreator(), rewardToken, BN(100), context.farming.address)
        await erc20Helper.ensureBalancesAndApprovals(actors.incentiveCreator(), bonusRewardToken, BN(100), context.farming.address)
        await context.farming.connect(actors.incentiveCreator()).createIncentive(incentiveKey, 100, 100)
        const incentiveId = await context.testIncentiveId.compute(incentiveKey)
        let { numberOfFarms } = await context.farming.incentives(
          incentiveId
        )
        expect(numberOfFarms).to.equal(0)
        expect(await rewardToken.balanceOf(context.farming.address)).to.eq(100)
        const { tokenId } = await helpers.mintFlow({
          lp: actors.lpUser0(),
          tokens: [context.token0, context.token1],
        })
        await helpers.depositFlow({
          lp: actors.lpUser0(),
          tokenId,
        })

        await erc20Helper.ensureBalancesAndApprovals(actors.lpUser0(), rewardToken, BN(50), context.farming.address)

        //await Time.set(testTimestamps.startTime)
        await context.farming
          .connect(actors.lpUser0())
          .multicall([
            //context.farming.interface.encodeFunctionData('createIncentive', [incentiveKey, 50]),
            context.farming.interface.encodeFunctionData('EnterFarming', [incentiveKey, tokenId]),
          ])
        ;({ numberOfFarms } = await context.farming
          .connect(actors.lpUser0())
          .incentives(incentiveId))
        expect(numberOfFarms).to.equal(1)
      })

      it('has gas cost', async () => {
        await snapshotGasCost(subject({}))
      })
    })

    describe('fails when', () => {
      describe('invalid timestamps', () => {
        it('current time is after start time', async () => {
          const params = makeTimestamps(await blockTimestamp(), 100_000)

          // Go to after the start time
          await Time.setAndMine(params.startTime + 100)

          const now = await blockTimestamp()
          expect(now).to.be.greaterThan(params.startTime, 'test setup: before start time')

          expect(now).to.be.lessThan(params.endTime, 'test setup: after end time')

          await expect(subject(params)).to.be.revertedWith(
            'AlgebraFarming::createIncentive: start time must be now or in the future'
          )
        })

        it('end time is before start time', async () => {
          const params = makeTimestamps(await blockTimestamp())
          params.endTime = params.startTime - 10
          await expect(subject(params)).to.be.revertedWith(
            'AlgebraFarming::createIncentive: start time must be before end time'
          )
        })

        it('start time is too far into the future', async () => {
          const params = makeTimestamps((await blockTimestamp()) + 2 ** 32 + 1)
          await expect(subject(params)).to.be.revertedWith(
            'AlgebraFarming::createIncentive: start time too far into future'
          )
        })

        it('end time is within valid duration of start time', async () => {
          const params = makeTimestamps(await blockTimestamp())
          params.endTime = params.startTime + 2 ** 32 + 1
          await expect(subject(params)).to.be.revertedWith(
            'AlgebraFarming::createIncentive: incentive duration is too long'
          )
        })
      })

      describe('invalid reward', () => {
        it('totalReward is 0 or an invalid amount', async () => {
          const now = await blockTimestamp()

          await expect(
            context.farming.connect(incentiveCreator).createIncentive(
              {
                rewardToken: context.rewardToken.address,
                bonusRewardToken: context.bonusRewardToken.address,
                pool: context.pool01,
                refundee: incentiveCreator.address,
                ...makeTimestamps(now, 1_000),
              },
              BNe18(0),
              BNe18(0)
            )
          ).to.be.revertedWith('AlgebraFarming::createIncentive: reward must be positive')
        })
      })
    })
  })

  // describe('#endIncentive', () => {
  //   let subject: (params: Partial<ContractParams.EndIncentive>) => Promise<any>
  //   let createIncentiveResult: HelperTypes.CreateIncentive.Result
  //
  //   beforeEach('setup', async () => {
  //     timestamps = makeTimestamps(await blockTimestamp())
  //
  //     createIncentiveResult = await helpers.createIncentiveFlow({
  //       ...timestamps,
  //       rewardToken: context.rewardToken,
  //       poolAddress: context.poolObj.address,
  //       totalReward,
  //     })
  //
  //     subject = async (params: Partial<ContractParams.EndIncentive> = {}) => {
  //       return await context.farming.connect(incentiveCreator).endIncentive({
  //         rewardToken: params.rewardToken || context.rewardToken.address,
  //         pool: context.pool01,
  //         startTime: params.startTime || timestamps.startTime,
  //         endTime: params.endTime || timestamps.endTime,
  //         refundee: incentiveCreator.address,
  //       })
  //     }
  //   })
  //
  //   describe('works and', () => {
  //     it('emits IncentiveEnded event', async () => {
  //       await Time.set(timestamps.endTime + 10)
  //
  //       const incentiveId = await helpers.getIncentiveId(createIncentiveResult)
  //
  //       await expect(subject({}))
  //         .to.emit(context.farming, 'IncentiveEnded')
  //         .withArgs(incentiveId, '100000000000000000000')
  //     })
  //
  //     it('deletes incentives[key]', async () => {
  //       const incentiveId = await helpers.getIncentiveId(createIncentiveResult)
  //       expect((await context.farming.incentives(incentiveId)).totalRewardUnclaimed).to.be.gt(0)
  //
  //       await Time.set(timestamps.endTime + 1)
  //       await subject({})
  //       const { totalRewardUnclaimed, totalSecondsClaimedX128, numberOfFarms } = await context.farming.incentives(
  //         incentiveId
  //       )
  //       expect(totalRewardUnclaimed).to.eq(0)
  //       expect(totalSecondsClaimedX128).to.eq(0)
  //       expect(numberOfFarms).to.eq(0)
  //     })
  //
  //     it('has gas cost', async () => {
  //       await Time.set(timestamps.endTime + 1)
  //       await snapshotGasCost(subject({}))
  //     })
  //   })
  //
  //   describe('reverts when', async () => {
  //     it('block.timestamp <= end time', async () => {
  //       await Time.set(timestamps.endTime - 10)
  //       await expect(subject({})).to.be.revertedWith(
  //         'AlgebraFarming::endIncentive: cannot end incentive before end time'
  //       )
  //     })
  //
  //     it('incentive does not exist', async () => {
  //       // Adjust the block.timestamp so it is after the claim deadline
  //       await Time.set(timestamps.endTime + 1)
  //       await expect(
  //         subject({
  //           startTime: (await blockTimestamp()) + 1000,
  //         })
  //       ).to.be.revertedWith('AlgebraFarming::endIncentive: no refund available')
  //     })
  //
  //     it('incentive has farms', async () => {
  //       await Time.set(timestamps.startTime)
  //       const amountDesired = BNe18(10)
  //       // farm a token
  //       await helpers.mintDepositFarmFlow({
  //         lp: actors.lpUser0(),
  //         createIncentiveResult,
  //         tokensToFarm: [context.token0, context.token1],
  //         ticks: [getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]), getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])],
  //         amountsToFarm: [amountDesired, amountDesired],
  //       })
  //
  //       // Adjust the block.timestamp so it is after the claim deadline
  //       await Time.set(timestamps.endTime + 1)
  //       await expect(subject({})).to.be.revertedWith(
  //         'AlgebraFarming::endIncentive: cannot end incentive while deposits are farmd'
  //       )
  //     })
  //   })
  // })
})
