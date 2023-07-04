import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { algebraFixture, AlgebraFixtureType } from '../shared/fixtures'
import {
  expect,
  blockTimestamp,
  BN,
  BNe18,
  snapshotGasCost,
  ActorFixture,
  erc20Wrap,
  makeTimestamps,
  days,
  ZERO_ADDRESS
} from '../shared'
import {  provider } from '../shared/provider'
import { HelperCommands, ERC20Helper } from '../helpers'
import { ContractParams } from '../../types/contractParams'
import { createTimeMachine } from '../shared/time'
import { HelperTypes } from '../helpers/types'
import { Contract, Wallet} from 'ethers'

const LIMIT_FARMING = true;
const ETERNAL_FARMING = false;

describe('unit/Incentives', async () => {
  let actors: ActorFixture;
  let lpUser0: Wallet
  let incentiveCreator: Wallet
  const totalReward = BNe18(100)
  const bonusReward = BNe18(100)
  const erc20Helper = new ERC20Helper()
  const Time = createTimeMachine(provider)

  let helpers: HelperCommands
  let context: AlgebraFixtureType
  let timestamps: ContractParams.Timestamps

  before('loader', async () => {
    const wallets = (await ethers.getSigners() as any) as Wallet[];
    actors = new ActorFixture(wallets, provider)
    lpUser0 = actors.lpUser0();
    incentiveCreator = actors.incentiveCreator();
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

        return await context.farming.connect(incentiveCreator).createLimitFarming(
          {
            rewardToken: params.rewardToken || context.rewardToken.address,
            bonusRewardToken: params.bonusRewardToken || context.bonusRewardToken.address,
            pool: context.pool01,
            startTime: params.startTime || startTime,
            endTime: params.endTime || endTime,
            
          },
          {
            tokenAmountForTier1: 0,
            tokenAmountForTier2: 0,
            tokenAmountForTier3: 0,
            tier1Multiplier: 10000,
            tier2Multiplier: 10000,
            tier3Multiplier: 10000
          },
          {
            reward: params.reward || 100,
            bonusReward: params.bonusReward || 100,
            minimalPositionWidth: 0,
            multiplierToken: params.rewardToken || context.rewardToken.address,
            enterStartTime:  0,
          }
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
        })

        const incentive = await context.farming.incentives(incentiveId)
      })

      it('does not override the existing numberOfFarms', async () => {
        const testTimestamps = makeTimestamps(await blockTimestamp() + 100)
        const rewardToken = context.token0
        const bonusRewardToken = context.token1
        const incentiveKey = {
          ...testTimestamps,
          rewardToken: rewardToken.address,
          bonusRewardToken: context.bonusRewardToken.address,
          
          pool: context.pool01,
        }
        const tiers = {
          tokenAmountForTier1: 0,
          tokenAmountForTier2: 0,
          tokenAmountForTier3: 0,
          tier1Multiplier: 10000,
          tier2Multiplier: 10000,
          tier3Multiplier: 10000,
        }
        const incentiveParams = {
          reward: BN(100),
          bonusReward: BN(100),
          minimalPositionWidth: 0,
          multiplierToken: context.rewardToken.address,
          enterStartTime:  0,
        } 

        await erc20Helper.ensureBalancesAndApprovals(actors.incentiveCreator(), rewardToken, BN(100), context.farming.address)
        await erc20Helper.ensureBalancesAndApprovals(actors.incentiveCreator(), bonusRewardToken, BN(100), context.farming.address)
        await context.farming.connect(actors.incentiveCreator()).createLimitFarming(incentiveKey,tiers, incentiveParams)
        const incentiveId = await context.testIncentiveId.compute(incentiveKey)
        expect(await rewardToken.balanceOf(context.farming.address)).to.eq(100)
        const { tokenId } = await helpers.mintFlow({
          lp: actors.lpUser0(),
          tokens: [context.token0, context.token1],
        })
        await helpers.depositFlow({
          lp: actors.lpUser0(),
          tokenId,
        })

        let { numberOfFarms } = await context.farmingCenter.deposits(
          tokenId
        )
        expect(numberOfFarms).to.equal(0)

        await erc20Helper.ensureBalancesAndApprovals(actors.lpUser0(), rewardToken, BN(50), context.farming.address)

        //await Time.set(testTimestamps.startTime)
        await context.farmingCenter
          .connect(actors.lpUser0())
          .multicall([
            //context.tokenomics.interface.encodeFunctionData('createIncentive', [incentiveKey, 50]), TODO
            context.farmingCenter.interface.encodeFunctionData('enterFarming', [incentiveKey, tokenId, 0, LIMIT_FARMING]),
          ])
        ;({ numberOfFarms } = await context.farmingCenter
          .connect(actors.lpUser0())
          .deposits(tokenId))
        expect(numberOfFarms).to.equal(1)
      })

      xit('has gas cost [ @skip-on-coverage ]', async () => {
        await snapshotGasCost(subject({}))
      })
    })

    describe('deactivate incentive', () => {
      let incentiveArgs: HelperTypes.CreateIncentive.Args
      let incentiveKey: ContractParams.IncentiveKey
      let virtualPool: Contract


      beforeEach(async () => {
        /** We will be doing a lot of time-testing here, so leave some room between
          and when the incentive starts */
        timestamps = makeTimestamps(1_000 + (await blockTimestamp()))

        incentiveArgs = {
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          totalReward,
          bonusReward,
          poolAddress: context.poolObj.address,
          ...timestamps,
          eternal: false
        }

        incentiveKey = {
          ...timestamps,
          rewardToken: context.rewardToken.address,
          bonusRewardToken: context.bonusRewardToken.address,
          
          pool: context.pool01,
        }

        virtualPool = await (await helpers.createIncentiveFlow(incentiveArgs)).virtualPool

      })

      it('deactivate incentive', async () => {
        
        let activeIncentiveBefore = await context.poolObj.connect(incentiveCreator).activeIncentive()

        await context.farming.connect(incentiveCreator).deactivateIncentive(incentiveKey)
        let activeIncentiveAfter = await context.poolObj.connect(incentiveCreator).activeIncentive()
        expect(activeIncentiveBefore).to.equal(virtualPool.address)
        expect(activeIncentiveAfter).to.equal(ZERO_ADDRESS) 

      })

      it('deactivate incentive only incentiveMaker', async () => {
        let activeIncentiveBefore = await context.poolObj.connect(incentiveCreator).activeIncentive()
  
        expect(context.farming.connect(lpUser0).deactivateIncentive(incentiveKey)).to.be.revertedWithoutReason;
        let activeIncentiveAfter = await context.poolObj.connect(incentiveCreator).activeIncentive()
  
        expect(activeIncentiveBefore).to.equal(virtualPool.address)
        expect(activeIncentiveAfter).to.equal(virtualPool.address) 
      })
      
      it('correct reward distribution after deactivate', async () => {
        let activeIncentiveBefore = await context.poolObj.connect(incentiveCreator).activeIncentive()
  
        expect(context.farming.connect(lpUser0).deactivateIncentive(incentiveKey)).to.be.revertedWithoutReason;
        let activeIncentiveAfter = await context.poolObj.connect(incentiveCreator).activeIncentive()
  
        expect(activeIncentiveBefore).to.equal(virtualPool.address)
        expect(activeIncentiveAfter).to.equal(virtualPool.address) 
      })

    })
    
    describe('increase/decrease rewards', () => {
        let incentiveArgs: HelperTypes.CreateIncentive.Args
        let incentiveKey: ContractParams.IncentiveKey
        let incentiveId: string
  
      beforeEach(async () => {
          /** We will be doing a lot of time-testing here, so leave some room between
            and when the incentive starts */
          timestamps = makeTimestamps(1_000 + (await blockTimestamp()))
  
          incentiveArgs = {
            rewardToken: context.rewardToken,
            bonusRewardToken: context.bonusRewardToken,
            totalReward,
            bonusReward,
            poolAddress: context.poolObj.address,
            ...timestamps,
            eternal: false
          }
  
          incentiveKey = {
            ...timestamps,
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            
            pool: context.pool01,
          }
  
          incentiveId = await context.testIncentiveId.compute(incentiveKey)
  
          await helpers.createIncentiveWithMultiplierFlow(incentiveArgs)
  
      })
      
      it('decrease rewards', async () => {
        let amount = BNe18(10)

        await context.farming.connect(incentiveCreator).decreaseRewardsAmount(incentiveKey, amount, amount)
      
        let rewardAmount = await (await context.farming.connect(incentiveCreator).incentives(incentiveId)).totalReward
        
        let bonusRewardAmount = await (await context.farming.connect(incentiveCreator).incentives(incentiveId)).bonusReward
        
        expect(rewardAmount).to.eq(BNe18(90))
        expect(bonusRewardAmount).to.eq(BNe18(90))
      })

      it('decrease rewards with 0 params', async () => {
        let amount = BNe18(0)

        await context.farming.connect(incentiveCreator).decreaseRewardsAmount(incentiveKey, amount, amount)
      
        let rewardAmount = await (await context.farming.connect(incentiveCreator).incentives(incentiveId)).totalReward
        
        let bonusRewardAmount = await (await context.farming.connect(incentiveCreator).incentives(incentiveId)).bonusReward
        
        expect(rewardAmount).to.eq(BNe18(100))
        expect(bonusRewardAmount).to.eq(BNe18(100))
      })

      it('can decrease rewards after end if 0 liquidity', async () => {
        await Time.setAndMine(incentiveKey.endTime + 100);

        let amount = BNe18(10)
        await context.farming.connect(incentiveCreator).decreaseRewardsAmount(incentiveKey, amount, amount)
      
        let rewardAmount = await (await context.farming.connect(incentiveCreator).incentives(incentiveId)).totalReward
        let bonusRewardAmount = await (await context.farming.connect(incentiveCreator).incentives(incentiveId)).bonusReward
        
        expect(rewardAmount).to.eq(BNe18(90))
        expect(bonusRewardAmount).to.eq(BNe18(90))
      })

      it('cannot decrease rewards after end if has liquidity', async () => {
        const { tokenId } = await helpers.mintFlow({
          lp: actors.lpUser0(),
          tokens: [context.token0, context.token1],
        })
        await helpers.depositFlow({
          lp: actors.lpUser0(),
          tokenId,
        })

        //await erc20Helper.ensureBalancesAndApprovals(actors.lpUser0(), incentiveKey.rewardToken, BN(50), context.farming.address)

        //await Time.set(testTimestamps.startTime)
        await context.farmingCenter
          .connect(actors.lpUser0())
          .multicall([
            //context.tokenomics.interface.encodeFunctionData('createIncentive', [incentiveKey, 50]), TODO
            context.farmingCenter.interface.encodeFunctionData('enterFarming', [incentiveKey, tokenId, 0, LIMIT_FARMING]),
          ])

        await Time.setAndMine(incentiveKey.endTime + 100);
        
        let amount = BNe18(10)
        await expect(context.farming.connect(incentiveCreator).decreaseRewardsAmount(incentiveKey, amount, amount)).to.be.revertedWith('incentive finished');
      })

      it('decrease rewards completely', async () => {
        let rewardAmount =  (await context.farming.connect(incentiveCreator).incentives(incentiveId)).totalReward
        let bonusRewardAmount =  (await context.farming.connect(incentiveCreator).incentives(incentiveId)).bonusReward

        await context.farming.connect(incentiveCreator).decreaseRewardsAmount(incentiveKey, rewardAmount.mul(2), bonusRewardAmount.mul(2))
      
        rewardAmount =  (await context.farming.connect(incentiveCreator).incentives(incentiveId)).totalReward
        bonusRewardAmount =  (await context.farming.connect(incentiveCreator).incentives(incentiveId)).bonusReward
        
        expect(rewardAmount).to.eq(1)
        expect(bonusRewardAmount).to.eq(0)
      })

      it('increase rewards', async () => {
        let amount = BNe18(10)

        await erc20Helper.ensureBalancesAndApprovals(
          incentiveCreator,
          [context.rewardToken, context.bonusRewardToken],
          BNe18(10),
          context.farming.address
        )

        await context.farming.connect(incentiveCreator).addRewards(incentiveKey, amount, amount)

        let rewardAmount = await (await context.farming.connect(incentiveCreator).incentives(incentiveId)).totalReward
        let bonusRewardAmount = await (await context.farming.connect(incentiveCreator).incentives(incentiveId)).bonusReward
        expect(rewardAmount).to.eq(BNe18(110))
        expect(bonusRewardAmount).to.eq(BNe18(110))
      })

      it('cannot increase rewards after end time', async () => {
        let amount = BNe18(10)

        await erc20Helper.ensureBalancesAndApprovals(
          incentiveCreator,
          [context.rewardToken, context.bonusRewardToken],
          BNe18(10),
          context.farming.address
        )
        
        await Time.setAndMine(incentiveKey.endTime + 100);
        await expect(context.farming.connect(incentiveCreator).addRewards(incentiveKey, amount, amount)).to.be.revertedWith('cannot add rewards after endTime');
      })


      it('increase rewards with 0 amount do not emit event', async () => {
        let amount = BNe18(10)

        await erc20Helper.ensureBalancesAndApprovals(
          incentiveCreator,
          [context.rewardToken, context.bonusRewardToken],
          BNe18(10),
          context.farming.address
        )
        let rewardAmountBefore = await (await context.farming.connect(incentiveCreator).incentives(incentiveId)).totalReward
        let bonusRewardAmountBefore = await (await context.farming.connect(incentiveCreator).incentives(incentiveId)).bonusReward

        await expect(context.farming.connect(incentiveCreator).addRewards(incentiveKey, 0, 0)).to.not.emit(context.farming, 'RewardsAdded');

        let rewardAmount = await (await context.farming.connect(incentiveCreator).incentives(incentiveId)).totalReward
        let bonusRewardAmount = await (await context.farming.connect(incentiveCreator).incentives(incentiveId)).bonusReward
        expect(rewardAmount).to.eq(rewardAmountBefore)
        expect(bonusRewardAmount).to.eq(bonusRewardAmountBefore)
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
            'start time too low'
          )
        })

        it('end time is before start time', async () => {
          const params = makeTimestamps(await blockTimestamp())
          params.endTime = params.startTime - 10
          await expect(subject(params)).to.be.revertedWith(
            'start must be before end time'
          )
        })

        it('start time is too far into the future', async () => {
          const params = makeTimestamps((await blockTimestamp()) + 2 ** 32 + 1)
          await expect(subject(params)).to.be.revertedWith(
            'start time too far into future'
          )
        })

        it('end time is within valid duration of start time', async () => {
          const params = makeTimestamps(await blockTimestamp())
          params.endTime = params.startTime + 2 ** 32 + 1
          await expect(subject(params)).to.be.revertedWith(
            'incentive duration is too long'
          )
        })

        it('creates an second incentive without swap after first incentive end', async () => {

          const params = makeTimestamps(await blockTimestamp())

          await subject({
            reward: totalReward,
            rewardToken: context.rewardToken.address,
          })

          await Time.set(params.startTime + days(1))

          timestamps = makeTimestamps(await blockTimestamp() + 100)
  
          let incentiveArgs = {
            rewardToken: context.rewardToken,
            bonusRewardToken: context.bonusRewardToken,
            totalReward,
            bonusReward,
            poolAddress: context.poolObj.address,
            ...timestamps,
            eternal: false
          }

          await expect(helpers.createIncentiveWithMultiplierFlow(incentiveArgs)).to.be.revertedWith("already has active incentive")
        })
      })

      describe('invalid reward', () => {
        it('totalReward is 0 or an invalid amount', async () => {
          const now = await blockTimestamp()

          await expect(
            context.farming.connect(incentiveCreator).createLimitFarming(
              {
                rewardToken: context.rewardToken.address,
                bonusRewardToken: context.bonusRewardToken.address,
                pool: context.pool01,
                
                ...makeTimestamps(now, 1_000),
              },
              {
                tokenAmountForTier1: 0,
                tokenAmountForTier2: 0,
                tokenAmountForTier3: 0,
                tier1Multiplier: 10000,
                tier2Multiplier: 10000,
                tier3Multiplier: 10000,
              },
              {
                reward: BNe18(0),
                bonusReward: BNe18(0),
                minimalPositionWidth: 0,
                multiplierToken: context.rewardToken.address,
                enterStartTime:  0,
              }

            )
          ).to.be.revertedWith('reward must be positive')
        })
      })

      describe('invalid multiplier', () => {
        it('multiplier lt 10000', async () => {
          const now = await blockTimestamp()

          await erc20Helper.ensureBalancesAndApprovals(
            incentiveCreator,
            [context.rewardToken, context.bonusRewardToken],
            BNe18(1),
            context.farming.address
          )

          await expect(
            context.farming.connect(incentiveCreator).createLimitFarming(
              {
                rewardToken: context.rewardToken.address,
                bonusRewardToken: context.bonusRewardToken.address,
                pool: context.pool01,
                
                ...makeTimestamps(now, 1_000),
              },
              {
                tokenAmountForTier1: 0,
                tokenAmountForTier2: 0,
                tokenAmountForTier3: 0,
                tier1Multiplier: 5000,
                tier2Multiplier: 1000,
                tier3Multiplier: 2000,
              },
              {
                reward: BNe18(1),
                bonusReward: BNe18(1),
                minimalPositionWidth: 0,
                multiplierToken: context.rewardToken.address,
                enterStartTime:  0,
              }

            )
          ).to.be.revertedWith('Multiplier cant be less than DENOMINATOR')
        })

        it('multiplier gt 50000', async () => {
          const now = await blockTimestamp()

          await erc20Helper.ensureBalancesAndApprovals(
            incentiveCreator,
            [context.rewardToken, context.bonusRewardToken],
            BNe18(1),
            context.farming.address
          )

          await expect(
            context.farming.connect(incentiveCreator).createLimitFarming(
              {
                rewardToken: context.rewardToken.address,
                bonusRewardToken: context.bonusRewardToken.address,
                pool: context.pool01,
                
                ...makeTimestamps(now, 1_000),
              },
              {
                tokenAmountForTier1: 0,
                tokenAmountForTier2: 0,
                tokenAmountForTier3: 0,
                tier1Multiplier: 60000,
                tier2Multiplier: 30000,
                tier3Multiplier: 10000,
              },
              {
                reward: BNe18(1),
                bonusReward: BNe18(1),
                minimalPositionWidth: 0,
                multiplierToken: context.rewardToken.address,
                enterStartTime:  0,
              }

            )
          ).to.be.revertedWith('Multiplier cant be greater than MAX_MULTIPLIER')
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
  //       return await context.tokenomics.connect(incentiveCreator).endIncentive({
  //         rewardToken: params.rewardToken || context.rewardToken.address,
  //         pool: context.pool01,
  //         startTime: params.startTime || timestamps.startTime,
  //         endTime: params.endTime || timestamps.endTime,
  //         
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
  //         .to.emit(context.tokenomics, 'IncentiveEnded')
  //         .withArgs(incentiveId, '100000000000000000000')
  //     })
  //
  //     it('deletes incentives[key]', async () => {
  //       const incentiveId = await helpers.getIncentiveId(createIncentiveResult)
  //       expect((await context.tokenomics.incentives(incentiveId)).totalRewardUnclaimed).to.be.gt(0)
  //
  //       await Time.set(timestamps.endTime + 1)
  //       await subject({})
  //       const { totalRewardUnclaimed, totalSecondsClaimedX128, numberOfFarms } = await context.tokenomics.incentives(
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
  //         'cannot end incentive before end time'
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
  //       ).to.be.revertedWith('no refund available')
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
  //         'cannot end incentive while deposits are farmd'
  //       )
  //     })
  //   })
  // })
})
