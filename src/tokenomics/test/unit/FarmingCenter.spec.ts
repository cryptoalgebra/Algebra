import { ethers } from 'hardhat'
import { BigNumber, Contract, Wallet } from 'ethers'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { TestERC20, AlgebraEternalFarming } from '../../typechain'
import { algebraFixture, mintPosition, AlgebraFixtureType } from '../shared/fixtures'
import {
  expect,
  getMaxTick,
  getMinTick,
  FeeAmount,
  TICK_SPACINGS,
  blockTimestamp,
  BN,
  BNe,
  BNe18,
  snapshotGasCost,
  ActorFixture,
  makeTimestamps,
  maxGas,
  ZERO_ADDRESS,
} from '../shared'
import { provider } from '../shared/provider'
import { HelperCommands, ERC20Helper, incentiveResultToFarmAdapter } from '../helpers'
import { ContractParams } from '../../types/contractParams'
import { createTimeMachine } from '../shared/time'
import { HelperTypes } from '../helpers/types'

describe('unit/FarmingCenter', () => {
  let actors: ActorFixture
  let lpUser0: Wallet
  let incentiveCreator: Wallet
  const amountDesired = BNe18(10)
  const totalReward = BN(10000)
  const bonusReward = BN(200)
  const erc20Helper = new ERC20Helper()
  const Time = createTimeMachine(provider)
  let helpers: HelperCommands
  let context: AlgebraFixtureType
  let timestamps: ContractParams.Timestamps
  let tokenId: string

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
    await expect(context.farmingCenter.connectVirtualPool(actors.lpUser0().address, actors.lpUser0().address)).to.be.revertedWith(
      'only farming can call this'
    )
  })

  xdescribe('swap gas [ @skip-on-coverage ]', async () => {
    it('3 swaps', async () => {
      timestamps = makeTimestamps((await blockTimestamp()) + 1_000)

      const mintResult = await helpers.mintFlow({
        lp: lpUser0,
        tokens: [context.token0, context.token1],
      })
      tokenId = mintResult.tokenId

      let farmIncentiveKey = {
        rewardToken: context.rewardToken.address,
        bonusRewardToken: context.bonusRewardToken.address,
        pool: context.pool01,
        ...timestamps,
      }

      let incentiveIdEternal = await helpers.getIncentiveId(
        await helpers.createIncentiveFlow({
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          totalReward,
          bonusReward,
          poolAddress: context.poolObj.address,
          ...timestamps,
          rewardRate: BigNumber.from('10'),
          bonusRewardRate: BigNumber.from('50'),
        })
      )

      let incentiveId = await helpers.getIncentiveId(
        await helpers.createIncentiveFlow({
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          totalReward,
          bonusReward,
          poolAddress: context.poolObj.address,
          ...timestamps,
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
    let claimableEternal: BigNumber

    let tokenIdEternal: string

    beforeEach('setup', async () => {
      timestamps = makeTimestamps(await blockTimestamp())
      const tokensToFarm = [context.token0, context.token1] as [TestERC20, TestERC20]

      await erc20Helper.ensureBalancesAndApprovals(lpUser0, tokensToFarm, amountDesired, context.nft.address)

      createIncentiveResultEternal = await helpers.createIncentiveFlow({
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: context.poolObj.address,
        ...timestamps,
        rewardRate: BigNumber.from('100'),
        bonusRewardRate: BigNumber.from('50'),
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
      let balanceBefore = await context.eternalFarming.rewards(lpUser0.address, context.rewardToken.address)
      let bonusBalanceBefore = await context.eternalFarming.rewards(lpUser0.address, context.bonusRewardToken.address)

      await erc20Helper.ensureBalancesAndApprovals(
        incentiveCreator,
        [context.rewardToken, context.bonusRewardToken],
        BNe18(1),
        context.eternalFarming.address
      )

      await context.eternalFarming.connect(incentiveCreator).addRewards(
        {
          rewardToken: context.rewardToken.address,
          bonusRewardToken: context.bonusRewardToken.address,
          pool: context.pool01,
          ...timestamps,
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
          rewardToken: context.rewardToken.address,
          bonusRewardToken: context.bonusRewardToken.address,
          pool: context.pool01,
          ...timestamps,
        },
        tokenIdEternal
      )

      let balanceAfter = await context.eternalFarming.rewards(lpUser0.address, context.rewardToken.address)
      let bonusBalanceAfter = await context.eternalFarming.rewards(lpUser0.address, context.bonusRewardToken.address)

      expect(balanceAfter.sub(balanceBefore)).to.equal(BN(199299))
      expect(bonusBalanceAfter.sub(bonusBalanceBefore)).to.equal(BN(99349))
    })

    it('collect rewards after eternalFarming deactivate', async () => {
      let balanceBefore = await context.eternalFarming.rewards(lpUser0.address, context.rewardToken.address)
      let bonusBalanceBefore = await context.eternalFarming.rewards(lpUser0.address, context.bonusRewardToken.address)

      await erc20Helper.ensureBalancesAndApprovals(
        incentiveCreator,
        [context.rewardToken, context.bonusRewardToken],
        BNe18(1),
        context.eternalFarming.address
      )

      await context.eternalFarming.connect(incentiveCreator).addRewards(
        {
          rewardToken: context.rewardToken.address,
          bonusRewardToken: context.bonusRewardToken.address,
          pool: context.pool01,
          ...timestamps,
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
        rewardToken: context.rewardToken.address,
        bonusRewardToken: context.bonusRewardToken.address,
        pool: context.pool01,
        ...timestamps,
      })

      await context.farmingCenter.connect(lpUser0).collectRewards(
        {
          rewardToken: context.rewardToken.address,
          bonusRewardToken: context.bonusRewardToken.address,
          pool: context.pool01,
          ...timestamps,
        },
        tokenIdEternal
      )

      let balanceAfter = await context.eternalFarming.rewards(lpUser0.address, context.rewardToken.address)
      let bonusBalanceAfter = await context.eternalFarming.rewards(lpUser0.address, context.bonusRewardToken.address)

      expect(balanceAfter.sub(balanceBefore)).to.equal(BN(199299))
      expect(bonusBalanceAfter.sub(bonusBalanceBefore)).to.equal(BN(99349))
    })

    it('when requesting zero amount', async () => {
      await Time.set(timestamps.endTime + 10000)
      await context.farmingCenter.connect(lpUser0).collectRewards(
        {
          rewardToken: context.rewardToken.address,
          bonusRewardToken: context.bonusRewardToken.address,
          pool: context.pool01,
          ...timestamps,
        },
        tokenIdEternal
      )

      let balanceBefore = await context.eternalFarming.rewards(lpUser0.address, context.rewardToken.address)
      let bonusBalanceBefore = await context.eternalFarming.rewards(lpUser0.address, context.bonusRewardToken.address)

      await context.farmingCenter.connect(lpUser0).collectRewards(
        {
          rewardToken: context.rewardToken.address,
          bonusRewardToken: context.bonusRewardToken.address,
          pool: context.pool01,
          ...timestamps,
        },
        tokenIdEternal
      )

      let balanceAfter = await context.eternalFarming.rewards(lpUser0.address, context.rewardToken.address)
      let bonusBalanceAfter = await context.eternalFarming.rewards(lpUser0.address, context.bonusRewardToken.address)

      expect(balanceAfter.sub(balanceBefore)).to.equal(0)
      expect(bonusBalanceAfter.sub(bonusBalanceBefore)).to.equal(0)
    })

    it('collect with non-existent incentive', async () => {
      await expect(
        context.farmingCenter.connect(lpUser0).collectRewards(
          {
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            pool: context.pool12,
            ...timestamps,
          },
          tokenIdEternal
        )
      ).to.be.revertedWithCustomError(context.eternalFarming as AlgebraEternalFarming, 'incentiveNotExist')
    })

    it('collect with non-existent nft', async () => {
      await context.farmingCenter.connect(lpUser0).exitFarming(
        {
          rewardToken: context.rewardToken.address,
          bonusRewardToken: context.bonusRewardToken.address,
          pool: context.pool01,
          ...timestamps,
        },
        tokenIdEternal
      )

      await expect(
        context.farmingCenter.connect(lpUser0).collectRewards(
          {
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            pool: context.pool01,
            ...timestamps,
          },
          tokenIdEternal
        )
      ).to.be.revertedWithCustomError(context.eternalFarming as AlgebraEternalFarming, 'farmDoesNotExist')
    })
  })
})
