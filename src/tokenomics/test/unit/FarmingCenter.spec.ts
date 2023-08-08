import { ethers } from 'hardhat'
import { Wallet } from 'ethers'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { TestERC20, AlgebraEternalFarming } from '../../typechain'
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
  makeTimestamps,
} from '../shared'
import { provider } from '../shared/provider'
import { HelperCommands, ERC20Helper } from '../helpers'
import { createTimeMachine } from '../shared/time'
import { HelperTypes } from '../helpers/types'
import { ContractParams } from '../../types/contractParams'

describe('unit/FarmingCenter', () => {
  let actors: ActorFixture
  let lpUser0: Wallet
  let incentiveCreator: Wallet
  const amountDesired = BNe18(10)
  const totalReward = 10000n
  const bonusReward = 200n
  const erc20Helper = new ERC20Helper()
  const Time = createTimeMachine()
  let helpers: HelperCommands
  let context: AlgebraFixtureType
  let timestamps: ContractParams.Timestamps
  let tokenId: string
  let nonce = 0n

  before(async () => {
    const wallets = (await ethers.getSigners()) as any as Wallet[]
    actors = new ActorFixture(wallets, provider)
    lpUser0 = actors.lpUser0()
    incentiveCreator = actors.incentiveCreator()
  })

  beforeEach('create fixture loader', async () => {
    context = await loadFixture(algebraFixture)
    helpers = HelperCommands.fromTestContext(context, actors, provider)
  })

  it('cannot call connectVirtualPool directly', async () => {
    await expect(context.farmingCenter.connectVirtualPool(context.pool01, context.pool01)).to.be.revertedWith(
      'only farming can call this'
    )
  })

  xdescribe('swap gas [ @skip-on-coverage ]', async () => {
    it('3 swaps', async () => {
      nonce = await context.eternalFarming.numOfIncentives()

      const mintResult = await helpers.mintFlow({
        lp: lpUser0,
        tokens: [context.token0, context.token1],
      })
      tokenId = mintResult.tokenId

      let farmIncentiveKey = {
        rewardToken: await context.rewardToken.getAddress(),
        bonusRewardToken: await context.bonusRewardToken.getAddress(),
        pool: context.pool01,
        nonce: nonce
      }

      let incentiveIdEternal = await helpers.getIncentiveId(
        await helpers.createIncentiveFlow({
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          totalReward,
          bonusReward,
          poolAddress: await context.poolObj.getAddress(),
          nonce: nonce,
          rewardRate: 10n,
          bonusRewardRate: 50n,
        })
      )

      let incentiveId = await helpers.getIncentiveId(
        await helpers.createIncentiveFlow({
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          totalReward,
          bonusReward,
          poolAddress: await context.poolObj.getAddress(),
          nonce,
        })
      )

      // await Time.set(timestamps.startTime)
      await context.farmingCenter.connect(lpUser0).enterFarming(farmIncentiveKey, tokenId)
      await context.eternalFarming.farms(tokenId, incentiveId)

      const pool = context.poolObj.connect(actors.lpUser0())

      Time.set(timestamps.startTime + 10)
      //await provider.send('evm_mine', [timestamps.startTime + 100])
      const trader = actors.traderUser0()
      await snapshotGasCost(
        helpers.makeSwapGasCHeckFlow({
          trader,
          direction: 'up',
          desiredValue: 10,
        })
      )
      await snapshotGasCost(
        helpers.makeSwapGasCHeckFlow({
          trader,
          direction: 'up',
          desiredValue: 10,
        })
      )
      await snapshotGasCost(
        helpers.makeSwapGasCHeckFlow({
          trader,
          direction: 'up',
          desiredValue: 10,
        })
      )
    })
  })

  describe('#collectRewards', () => {
    let createIncentiveResultEternal: HelperTypes.CreateIncentive.Result
    // The amount the user should be able to claim
    let claimableEternal: bigint

    let tokenIdEternal: string

    beforeEach('setup', async () => {
      timestamps = makeTimestamps(await blockTimestamp())
      const tokensToFarm = [context.token0, context.token1] as [TestERC20, TestERC20]

      await erc20Helper.ensureBalancesAndApprovals(lpUser0, tokensToFarm, amountDesired, await context.nft.getAddress())

      createIncentiveResultEternal = await helpers.createIncentiveFlow({
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: await context.poolObj.getAddress(),
        nonce,
        rewardRate: 100n,
        bonusRewardRate: 50n,
      })

      await Time.setAndMine(timestamps.startTime + 1)

      const mintResultEternal = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm,
        ticks: [getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]), getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])],
        amountsToFarm: [amountDesired, amountDesired],
        createIncentiveResult: createIncentiveResultEternal
      })
      tokenIdEternal = mintResultEternal.tokenId

      const trader = actors.traderUser0()
      await helpers.makeTickGoFlow({
        trader,
        direction: 'up',
        desiredValue: 10,
      })
    })

    it('is works', async () => {
      let balanceBefore = await context.eternalFarming.rewards(lpUser0.address, context.rewardToken)
      let bonusBalanceBefore = await context.eternalFarming.rewards(lpUser0.address, context.bonusRewardToken)

      await erc20Helper.ensureBalancesAndApprovals(
        incentiveCreator,
        [context.rewardToken, context.bonusRewardToken],
        BNe18(1),
        await context.eternalFarming.getAddress()
      )

      await context.eternalFarming.connect(incentiveCreator).addRewards(
        {
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          pool: context.pool01,
          nonce,
        },
        BNe18(1),
        BNe18(1)
      )

      const trader = actors.traderUser0()

      await Time.set(timestamps.endTime + 1000)

      await helpers.makeTickGoFlow({
        trader,
        direction: 'up',
        desiredValue: 10,
      })

      await context.farmingCenter.connect(lpUser0).collectRewards(
        {
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          pool: context.pool01,
          nonce,
        },
        tokenIdEternal
      )

      let balanceAfter = await context.eternalFarming.rewards(lpUser0.address, context.rewardToken)
      let bonusBalanceAfter = await context.eternalFarming.rewards(lpUser0.address, context.bonusRewardToken)

      expect(balanceAfter - balanceBefore).to.equal(199699n)
      expect(bonusBalanceAfter - bonusBalanceBefore).to.equal(99549n)
    })

    it('collect rewards after eternalFarming deactivate', async () => {
      let balanceBefore = await context.eternalFarming.rewards(lpUser0.address, context.rewardToken)
      let bonusBalanceBefore = await context.eternalFarming.rewards(lpUser0.address, context.bonusRewardToken)

      await erc20Helper.ensureBalancesAndApprovals(
        incentiveCreator,
        [context.rewardToken, context.bonusRewardToken],
        BNe18(1),
        await context.eternalFarming.getAddress()
      )

      await context.eternalFarming.connect(incentiveCreator).addRewards(
        {
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          pool: context.pool01,
          nonce,
        },
        BNe18(1),
        BNe18(1)
      )

      const trader = actors.traderUser0()

      await Time.set(timestamps.endTime + 1000)

      await helpers.makeTickGoFlow({
        trader,
        direction: 'up',
        desiredValue: 10,
      })

      await context.eternalFarming.connect(incentiveCreator).deactivateIncentive({
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        pool: context.pool01,
        nonce,
      })

      await context.farmingCenter.connect(lpUser0).collectRewards(
        {
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          pool: context.pool01,
          nonce,
        },
        tokenIdEternal
      )

      let balanceAfter = await context.eternalFarming.rewards(lpUser0.address, context.rewardToken)
      let bonusBalanceAfter = await context.eternalFarming.rewards(lpUser0.address, context.bonusRewardToken)

      expect(balanceAfter - balanceBefore).to.equal(199699n)
      expect(bonusBalanceAfter - bonusBalanceBefore).to.equal(99549n)
    })

    it('when requesting zero amount', async () => {
      await Time.set(timestamps.endTime + 10000)
      await context.farmingCenter.connect(lpUser0).collectRewards(
        {
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          pool: context.pool01,
          nonce,
        },
        tokenIdEternal
      )

      let balanceBefore = await context.eternalFarming.rewards(lpUser0.address, context.rewardToken)
      let bonusBalanceBefore = await context.eternalFarming.rewards(lpUser0.address, context.bonusRewardToken)

      await context.farmingCenter.connect(lpUser0).collectRewards(
        {
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          pool: context.pool01,
          nonce,
        },
        tokenIdEternal
      )

      let balanceAfter = await context.eternalFarming.rewards(lpUser0.address, context.rewardToken)
      let bonusBalanceAfter = await context.eternalFarming.rewards(lpUser0.address, context.bonusRewardToken)

      expect(balanceAfter - balanceBefore).to.equal(0)
      expect(bonusBalanceAfter - bonusBalanceBefore).to.equal(0)
    })

    it('collect with non-existent incentive', async () => {
      await expect(
        context.farmingCenter.connect(lpUser0).collectRewards(
          {
            rewardToken: context.rewardToken,
            bonusRewardToken: context.bonusRewardToken,
            pool: context.pool12,
            nonce,
          },
          tokenIdEternal
        )
      ).to.be.revertedWithCustomError(context.eternalFarming as AlgebraEternalFarming, 'incentiveNotExist')
    })

    it('collect with non-existent nft', async () => {
      await context.farmingCenter.connect(lpUser0).exitFarming(
        {
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          pool: context.pool01,
          nonce,
        },
        tokenIdEternal
      )

      await expect(
        context.farmingCenter.connect(lpUser0).collectRewards(
          {
            rewardToken: context.rewardToken,
            bonusRewardToken: context.bonusRewardToken,
            pool: context.pool01,
            nonce,
          },
          tokenIdEternal
        )
      ).to.be.revertedWithCustomError(context.eternalFarming as AlgebraEternalFarming, 'farmDoesNotExist')
    })
  })
})
