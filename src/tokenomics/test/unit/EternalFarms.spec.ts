import { ethers } from 'hardhat'
import { BigNumber, Contract, Wallet } from 'ethers'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { TestERC20, TestIncentiveId, AlgebraEternalFarming } from '../../typechain'
import { mintPosition, AlgebraFixtureType, algebraFixture } from '../shared/fixtures'
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
  maxGas,
  ZERO_ADDRESS,
} from '../shared'
import { provider } from '../shared/provider'
import { HelperCommands, ERC20Helper, incentiveResultToFarmAdapter } from '../helpers'
import { ContractParams } from '../../types/contractParams'
import { createTimeMachine } from '../shared/time'
import { HelperTypes } from '../helpers/types'
import { IAlgebraVirtualPool } from '@cryptoalgebra/core/typechain'
import { AlgebraEternalFarming } from '../../typechain/contracts/farmings'

describe('unit/EternalFarms', () => {
  let actors: ActorFixture
  let lpUser0: Wallet
  let incentiveCreator: Wallet
  const amountDesired = BNe18(10)
  const totalReward = BigNumber.from('10000')
  const erc20Helper = new ERC20Helper()
  const Time = createTimeMachine(provider)
  let bonusReward = BigNumber.from('200')
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

  describe('#enterFarming', () => {
    let incentiveId: string
    let incentiveArgs: HelperTypes.CreateIncentive.Args
    let subject: (L2TokenId: string, _actor: Wallet) => Promise<any>

    beforeEach(async () => {
      context = await loadFixture(algebraFixture)
      helpers = HelperCommands.fromTestContext(context, actors, provider)

      /** We will be doing a lot of time-testing here, so leave some room between
        and when the incentive starts */
      timestamps = makeTimestamps(1_000 + (await blockTimestamp()))

      await erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.token0, context.token1], amountDesired, context.nft.address)

      tokenId = await mintPosition(context.nft.connect(lpUser0), {
        token0: context.token0.address,
        token1: context.token1.address,
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: lpUser0.address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 1000,
      })

      incentiveArgs = {
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: context.poolObj.address,
        ...timestamps,
        rewardRate: BigNumber.from('10'),
        bonusRewardRate: BigNumber.from('50'),
      }

      incentiveId = await helpers.getIncentiveId(await helpers.createIncentiveFlow(incentiveArgs))

      await context.nft.connect(lpUser0).approveForFarming(tokenId, true)
      subject = (L2TokenId: string, _actor: Wallet) =>
        context.farmingCenter.connect(_actor).enterFarming(
          {
            pool: context.pool01,
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            ...timestamps,
          },
          L2TokenId
        )
    })

    describe('increaseLiqudity', () => {
      it('liquidity updated correct', async () => {
        await subject(tokenId, lpUser0)
        await erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.token0, context.token1], amountDesired, context.nft.address)

        let farmBefore = await context.eternalFarming.farms(tokenId, incentiveId)
        await context.nft.connect(lpUser0).increaseLiquidity({
          tokenId: tokenId,
          amount0Desired: amountDesired,
          amount1Desired: amountDesired,
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 1000,
        })
        let farmAfter = await context.eternalFarming.farms(tokenId, incentiveId)
        expect(farmAfter.liquidity.sub(farmBefore.liquidity)).to.eq(amountDesired)
      })
    })

    describe('works and', () => {
      // Make sure the incentive has started
      // beforeEach(async () => {
      //   await Time.set(timestamps.startTime + 100)
      // })

      it('emits the farm event', async () => {
        const { liquidity } = await context.nft.positions(tokenId)
        await expect(subject(tokenId, lpUser0)).to.emit(context.eternalFarming, 'FarmEntered').withArgs(tokenId, incentiveId, liquidity)
      })

      it('sets the farm struct properly', async () => {
        const liquidity = (await context.nft.positions(tokenId)).liquidity

        const farmBefore = await context.eternalFarming.farms(tokenId, incentiveId)
        await subject(tokenId, lpUser0)
        const farmAfter = await context.eternalFarming.farms(tokenId, incentiveId)

        expect(farmBefore.liquidity).to.eq(0)
        expect(farmAfter.liquidity).to.eq(liquidity)
      })

      xit('has gas cost [ @skip-on-coverage ]', async () => await snapshotGasCost(subject(tokenId, lpUser0)))
    })

    describe('fails when', () => {
      it('deposit is already farmd in the incentive', async () => {
        //await Time.set(timestamps.startTime + 500)
        await subject(tokenId, lpUser0)
        await expect(subject(tokenId, lpUser0)).to.be.revertedWith('token already farmed')
      })

      it('you are not the owner of the deposit', async () => {
        //await Time.set(timestamps.startTime + 500)
        // lpUser2 calls, we're using lpUser0 elsewhere.
        await expect(subject(tokenId, actors.lpUser2())).to.be.revertedWith('not owner')
      })

      it('has 0 liquidity in the position', async () => {
        //await Time.set(timestamps.startTime + 500)
        await erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.token0, context.token1], amountDesired, context.nft.address)

        const tokenId2 = await mintPosition(context.nft.connect(lpUser0), {
          token0: context.token0.address,
          token1: context.token1.address,
          fee: FeeAmount.MEDIUM,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: lpUser0.address,
          amount0Desired: amountDesired,
          amount1Desired: amountDesired,
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 1000,
        })

        await context.nft.connect(lpUser0).approveForFarming(tokenId2, true)

        await context.nft.connect(lpUser0).decreaseLiquidity({
          tokenId: tokenId2,
          liquidity: (await context.nft.positions(tokenId2)).liquidity,
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 1_000,
        })
        await expect(subject(tokenId2, lpUser0)).to.be.revertedWithCustomError(context.eternalFarming as AlgebraEternalFarming, 'zeroLiquidity')
      })

      it('token id is for a different pool than the incentive', async () => {
        const incentive2 = await helpers.createIncentiveFlow({
          ...incentiveArgs,
          poolAddress: context.pool12,
        })
        const { tokenId: otherTokenId } = await helpers.mintFlow({
          lp: lpUser0,
          tokens: [context.token1, context.rewardToken],
        })

        // await Time.setAndMine(incentive2.startTime + 1)

        await helpers.depositFlow({
          lp: lpUser0,
          tokenId: otherTokenId,
        })

        await expect(
          context.farmingCenter.connect(lpUser0).enterFarming(
            {
              pool: context.pool01,
              rewardToken: context.rewardToken.address,
              bonusRewardToken: context.bonusRewardToken.address,
              ...timestamps,
            },
            otherTokenId
          )
        ).to.be.revertedWithCustomError(context.eternalFarming as AlgebraEternalFarming, 'invalidPool')
      })

      it('incentive key does not exist', async () => {
        // await Time.setAndMine(timestamps.startTime + 20)

        await expect(
          context.farmingCenter.connect(lpUser0).enterFarming(
            {
              pool: context.pool01,
              rewardToken: context.rewardToken.address,
              bonusRewardToken: context.bonusRewardToken.address,
              ...timestamps,
              startTime: timestamps.startTime + 10,
            },
            tokenId
          )
        ).to.be.revertedWithCustomError(context.eternalFarming as AlgebraEternalFarming, 'incentiveNotExist')
      })

      it('create second eternal farming for one pool', async () => {
        incentiveArgs = {
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          totalReward,
          bonusReward,
          poolAddress: context.poolObj.address,
          ...timestamps,
          rewardRate: BigNumber.from('10'),
          bonusRewardRate: BigNumber.from('50'),
        }

        await expect(helpers.createIncentiveFlow(incentiveArgs)).to.be.revertedWithCustomError(
          context.eternalFarming as AlgebraEternalFarming,
          'farmingAlreadyExists'
        )
      })
    })
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

      let incentiveId = await helpers.getIncentiveId(
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
          desiredValue: 200,
        })
      )
      await snapshotGasCost(
        helpers.makeSwapGasCHeckFlow({
          trader,
          direction: 'up',
          desiredValue: 200,
        })
      )
      await snapshotGasCost(
        helpers.makeSwapGasCHeckFlow({
          trader,
          direction: 'up',
          desiredValue: 200,
        })
      )
    })

    it('swap with cross', async () => {
      timestamps = makeTimestamps((await blockTimestamp()) + 1_000)

      const mintResult = await helpers.mintFlow({
        lp: lpUser0,
        tokens: [context.token0, context.token1],
        tickLower: -60,
        tickUpper: 60,
      })
      tokenId = mintResult.tokenId

      await helpers.mintFlow({
        lp: lpUser0,
        tokens: [context.token0, context.token1],
      })

      let farmIncentiveKey = {
        rewardToken: context.rewardToken.address,
        bonusRewardToken: context.bonusRewardToken.address,
        pool: context.pool01,
        ...timestamps,
      }

      let incentiveId = await helpers.getIncentiveId(
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
          amountIn: 150,
        })
      )
    })

    it('swap with second cross', async () => {
      let totalReward = BigNumber.from('9000000000000')
      let bonusReward = BigNumber.from('9000000000000')

      timestamps = makeTimestamps((await blockTimestamp()) + 1_000)

      const mintResult = await helpers.mintFlow({
        lp: lpUser0,
        tokens: [context.token0, context.token1],
        tickLower: -60,
        tickUpper: 60,
      })
      tokenId = mintResult.tokenId

      const mintResult2 = await helpers.mintFlow({
        lp: lpUser0,
        tokens: [context.token0, context.token1],
      })

      let farmIncentiveKey = {
        rewardToken: context.rewardToken.address,
        bonusRewardToken: context.bonusRewardToken.address,
        pool: context.pool01,
        ...timestamps,
      }

      let incentiveId = await helpers.getIncentiveId(
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

      // await Time.set(timestamps.startTime)
      await context.farmingCenter.connect(lpUser0).enterFarming(farmIncentiveKey, tokenId)
      await context.farmingCenter.connect(lpUser0).enterFarming(farmIncentiveKey, mintResult2.tokenId)

      await context.eternalFarming.farms(tokenId, incentiveId)

      const pool = context.poolObj.connect(actors.lpUser0())

      Time.set(timestamps.startTime + 10)
      const trader = actors.traderUser0()
      await helpers.makeSwapGasCHeckFlow({
        trader,
        direction: 'up',
        amountIn: 150,
      })

      Time.set(timestamps.startTime + 180)

      await snapshotGasCost(
        helpers.makeSwapGasCHeckFlow({
          trader,
          direction: 'down',
          amountIn: 150,
        })
      )

      console.log((await pool.globalState()).tick)
    })
  })

  describe('#getRewardInfo', () => {
    let incentiveId: string
    let farmIncentiveKey: ContractParams.IncentiveKey

    beforeEach('set up incentive and farm', async () => {
      timestamps = makeTimestamps((await blockTimestamp()) + 1_000)

      const mintResult = await helpers.mintFlow({
        lp: lpUser0,
        tokens: [context.token0, context.token1],
      })
      tokenId = mintResult.tokenId

      farmIncentiveKey = {
        rewardToken: context.rewardToken.address,
        bonusRewardToken: context.bonusRewardToken.address,
        pool: context.pool01,
        ...timestamps,
      }

      incentiveId = await helpers.getIncentiveId(
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

      // await Time.set(timestamps.startTime)
      await context.nft.connect(lpUser0).approveForFarming(tokenId, true)
      await context.farmingCenter.connect(lpUser0).enterFarming(farmIncentiveKey, tokenId)
      await context.eternalFarming.farms(tokenId, incentiveId)
    })

    it('returns correct rewardAmount and secondsInsideX128 for the position', async () => {
      const pool = context.poolObj.connect(actors.lpUser0())

      Time.set(timestamps.startTime + 10)
      //await provider.send('evm_mine', [timestamps.startTime + 100])
      const trader = actors.traderUser0()
      await helpers.makeTickGoFlow({
        trader,
        direction: 'up',
        desiredValue: 10,
      })

      Time.set(timestamps.endTime - 10)

      await helpers.makeTickGoFlow({
        trader,
        direction: 'up',
        desiredValue: 100,
      })

      Time.set(timestamps.endTime + 10)

      const rewardInfo = await context.eternalFarming.connect(lpUser0).getRewardInfo(farmIncentiveKey, tokenId)

      const { tickLower, tickUpper } = await context.nft.positions(tokenId)
      const { innerSecondsSpentPerLiquidity } = await pool.getInnerCumulatives(tickLower, tickUpper)
      const farm = await context.eternalFarming.farms(tokenId, incentiveId)

      const expectedSecondsInPeriod = innerSecondsSpentPerLiquidity.mul(farm.liquidity)

      // @ts-ignore
      expect(rewardInfo.reward).to.be.closeTo(BN('9900'), BN('10000'))
      //expect(rewardInfo.secondsInsideX128).to.equal(expectedSecondsInPeriod)
    })

    it('reverts if farm does not exist', async () => {
      // await Time.setAndMine(timestamps.endTime + 1)

      await expect(context.eternalFarming.connect(lpUser0).getRewardInfo(farmIncentiveKey, '100')).to.be.revertedWithCustomError(
        context.eternalFarming as AlgebraEternalFarming,
        'farmDoesNotExist'
      )
    })
  })

  describe('#claimReward', () => {
    let createIncentiveResult: HelperTypes.CreateIncentive.Result
    let subject: (token: string, to: string, amount: BigNumber) => Promise<any>
    // The amount the user should be able to claim
    let claimable: BigNumber

    beforeEach('setup', async () => {
      timestamps = makeTimestamps(await blockTimestamp())
      const tokensToFarm = [context.token0, context.token1] as [TestERC20, TestERC20]

      await erc20Helper.ensureBalancesAndApprovals(lpUser0, tokensToFarm, amountDesired, context.nft.address)

      createIncentiveResult = await helpers.createIncentiveFlow({
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: context.poolObj.address,
        ...timestamps,
        rewardRate: BigNumber.from('10'),
        bonusRewardRate: BigNumber.from('50'),
      })

      await Time.setAndMine(timestamps.startTime + 1)

      const mintResult = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm,
        ticks: [getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]), getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])],
        amountsToFarm: [amountDesired, amountDesired],
        createIncentiveResult,
      })
      tokenId = mintResult.tokenId

      await Time.setAndMine(timestamps.endTime + 10)
      await context.farmingCenter.connect(lpUser0).exitFarming(
        {
          rewardToken: context.rewardToken.address,
          bonusRewardToken: context.bonusRewardToken.address,
          pool: context.pool01,
          ...timestamps,
        },
        tokenId
      )

      claimable = await context.eternalFarming.rewards(lpUser0.address, context.rewardToken.address)

      subject = (_token: string, _to: string, _amount: BigNumber) => context.eternalFarming.connect(lpUser0).claimReward(_token, _to, _amount)
    })

    describe('when requesting the full amount', () => {
      it('emits RewardClaimed event', async () => {
        const { rewardToken } = context
        claimable = await context.eternalFarming.rewards(lpUser0.address, rewardToken.address)
        await expect(subject(rewardToken.address, lpUser0.address, BN('0')))
          .to.emit(context.eternalFarming, 'RewardClaimed')
          .withArgs(lpUser0.address, claimable, context.rewardToken.address, lpUser0.address)
      })

      it('transfers the correct reward amount to destination address', async () => {
        const { rewardToken } = context
        claimable = await context.eternalFarming.rewards(lpUser0.address, rewardToken.address)
        const balance = await rewardToken.balanceOf(lpUser0.address)
        await subject(rewardToken.address, lpUser0.address, BN('0'))
        expect(await rewardToken.balanceOf(lpUser0.address)).to.equal(balance.add(claimable))
      })

      it('sets the claimed reward amount to zero', async () => {
        const { rewardToken } = context
        expect(await context.eternalFarming.rewards(lpUser0.address, rewardToken.address)).to.not.equal(0)

        await subject(rewardToken.address, lpUser0.address, BN('0'))

        expect(await context.eternalFarming.rewards(lpUser0.address, rewardToken.address)).to.equal(0)
      })

      xit('has gas cost [ @skip-on-coverage ]', async () => await snapshotGasCost(subject(context.rewardToken.address, lpUser0.address, BN('0'))))

      it('returns their claimable amount', async () => {
        const { rewardToken, eternalFarming } = context
        const amountBefore = await rewardToken.balanceOf(lpUser0.address)
        await subject(rewardToken.address, lpUser0.address, BN('0'))
        expect(await eternalFarming.rewards(lpUser0.address, rewardToken.address)).to.eq(BN('0'))
        expect(await rewardToken.balanceOf(lpUser0.address)).to.eq(amountBefore.add(claimable))
      })
    })

    describe('when requesting a nonzero amount', () => {
      it('emits RewardClaimed event', async () => {
        const { rewardToken } = context
        await expect(subject(rewardToken.address, lpUser0.address, claimable))
          .to.emit(context.eternalFarming, 'RewardClaimed')
          .withArgs(lpUser0.address, claimable, context.rewardToken.address, lpUser0.address)
      })

      it('transfers the correct reward amount to destination address', async () => {
        const { rewardToken } = context
        claimable = await context.eternalFarming.rewards(lpUser0.address, rewardToken.address)
        const balance = await rewardToken.balanceOf(lpUser0.address)
        await subject(rewardToken.address, lpUser0.address, claimable)
        expect(await rewardToken.balanceOf(lpUser0.address)).to.equal(balance.add(claimable))
      })

      it('sets the claimed reward amount to the correct amount', async () => {
        const { rewardToken, eternalFarming } = context
        const initialRewardBalance = await eternalFarming.rewards(lpUser0.address, rewardToken.address)
        expect(initialRewardBalance).to.not.equal(BN('0'))

        const partialClaim = initialRewardBalance.div(BN('3'))
        await subject(rewardToken.address, lpUser0.address, partialClaim)

        expect(await eternalFarming.rewards(lpUser0.address, rewardToken.address)).to.eq(initialRewardBalance.sub(partialClaim))
      })

      describe('when user claims more than they have', () => {
        it('only transfers what they have', async () => {
          const { rewardToken, eternalFarming } = context
          const amountBefore = await rewardToken.balanceOf(lpUser0.address)
          await subject(rewardToken.address, lpUser0.address, claimable.mul(BN('3')))
          expect(await eternalFarming.rewards(lpUser0.address, rewardToken.address)).to.eq(BN('0'))
          expect(await rewardToken.balanceOf(lpUser0.address)).to.eq(amountBefore.add(claimable))
        })
      })
    })
  })

  describe('#exitFarming', () => {
    let incentiveId: string
    let subject: (actor: Wallet) => Promise<any>
    let createIncentiveResult: HelperTypes.CreateIncentive.Result

    describe('before end time', () => {
      it('can exitFarming', async () => {
        timestamps = makeTimestamps(await blockTimestamp())

        createIncentiveResult = await helpers.createIncentiveFlow({
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          totalReward,
          bonusReward,
          poolAddress: context.poolObj.address,
          ...timestamps,
          rewardRate: BigNumber.from('10'),
          bonusRewardRate: BigNumber.from('50'),
        })

        await erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.token0, context.token1], amountDesired, context.nft.address)

        tokenId = await mintPosition(context.nft.connect(lpUser0), {
          token0: context.token0.address,
          token1: context.token1.address,
          fee: FeeAmount.MEDIUM,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: lpUser0.address,
          amount0Desired: amountDesired,
          amount1Desired: amountDesired,
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 1000,
        })

        // await Time.setAndMine(timestamps.startTime + 1)
        await context.nft.connect(lpUser0).approveForFarming(tokenId, true)

        await context.farmingCenter.connect(lpUser0).enterFarming(
          {
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            pool: context.pool01,
            ...timestamps,
          },
          tokenId
        )

        incentiveId = await helpers.getIncentiveId(createIncentiveResult)

        await expect(
          context.farmingCenter.connect(actors.lpUser0()).exitFarming(
            {
              pool: context.pool01,
              rewardToken: context.rewardToken.address,
              bonusRewardToken: context.bonusRewardToken.address,
              ...timestamps,
            },
            tokenId
          )
        ).to.be.emit(context.eternalFarming, 'FarmEnded')
      })
    })

    describe('after end time', () => {
      let tokenIdOut: string
      beforeEach('create the incentive and nft and farm it', async () => {
        timestamps = makeTimestamps(await blockTimestamp())

        createIncentiveResult = await helpers.createIncentiveFlow({
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          totalReward,
          bonusReward,
          poolAddress: context.poolObj.address,
          ...timestamps,
          rewardRate: BigNumber.from('10'),
          bonusRewardRate: BigNumber.from('50'),
        })

        await erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.token0, context.token1], amountDesired.mul(3), context.nft.address)
        tokenId = await mintPosition(context.nft.connect(lpUser0), {
          token0: context.token0.address,
          token1: context.token1.address,
          fee: FeeAmount.MEDIUM,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          recipient: lpUser0.address,
          amount0Desired: amountDesired,
          amount1Desired: amountDesired,
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 1000,
        })

        tokenIdOut = await mintPosition(context.nft.connect(lpUser0), {
          token0: context.token0.address,
          token1: context.token1.address,
          fee: FeeAmount.MEDIUM,
          tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
          tickUpper: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]) + TICK_SPACINGS[FeeAmount.MEDIUM],
          recipient: lpUser0.address,
          amount0Desired: 0,
          amount1Desired: 100,
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 10000,
        })

        await Time.setAndMine(timestamps.startTime + 1)

        await context.nft.connect(lpUser0).approveForFarming(tokenId, true)
        await context.nft.connect(lpUser0).approveForFarming(tokenIdOut, true)
        await context.farmingCenter.connect(lpUser0).enterFarming(
          {
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            pool: context.pool01,
            ...timestamps,
          },
          tokenId
        )

        await context.farmingCenter.connect(lpUser0).enterFarming(
          {
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            pool: context.pool01,
            ...timestamps,
          },
          tokenIdOut
        )

        await Time.setAndMine(timestamps.endTime + 10)

        incentiveId = await helpers.getIncentiveId(createIncentiveResult)
        subject = (_actor: Wallet) =>
          context.farmingCenter.connect(_actor).exitFarming(
            {
              pool: context.pool01,
              rewardToken: context.rewardToken.address,
              bonusRewardToken: context.bonusRewardToken.address,
              ...timestamps,
            },
            tokenId
          )
      })

      describe('works and', () => {
        it('emits an exitFarmingd event', async () => {
          await expect(subject(lpUser0))
            .to.emit(context.eternalFarming, 'FarmEnded')
            .withArgs(tokenId, incentiveId, context.rewardToken.address, context.bonusRewardToken.address, lpUser0.address, BN('9999'), BN('199'))
        })

        xit('has gas cost [ @skip-on-coverage ]', async () => {
          await snapshotGasCost(subject(lpUser0))
        })

        it('updates the reward available for the context.tokenomics', async () => {
          const rewardsAccured = await context.eternalFarming.rewards(lpUser0.address, context.rewardToken.address)
          await subject(lpUser0)
          expect(await context.eternalFarming.rewards(lpUser0.address, context.rewardToken.address)).to.be.gt(rewardsAccured)
        })

        it('updates the farm struct', async () => {
          const farmBefore = await context.eternalFarming.farms(tokenId, incentiveId)
          await subject(lpUser0)
          const farmAfter = await context.eternalFarming.farms(tokenId, incentiveId)

          expect(farmBefore.liquidity).to.gt(0)
          expect(farmAfter.liquidity).to.eq(0)
        })
      })

      it('can exit without rewards', async () => {
        await expect(
          context.farmingCenter.connect(lpUser0).exitFarming(
            {
              pool: context.pool01,
              rewardToken: context.rewardToken.address,
              bonusRewardToken: context.bonusRewardToken.address,
              ...timestamps,
            },
            tokenIdOut
          )
        )
          .to.emit(context.eternalFarming, 'FarmEnded')
          .withArgs(tokenIdOut, incentiveId, context.rewardToken.address, context.bonusRewardToken.address, lpUser0.address, BN('0'), BN('0'))
      })

      it('cannot exit twice', async () => {
        await subject(lpUser0)
        await expect(
          context.farmingCenter.connect(lpUser0).exitFarming(
            {
              pool: context.pool01,
              rewardToken: context.rewardToken.address,
              bonusRewardToken: context.bonusRewardToken.address,
              ...timestamps,
            },
            tokenId
          )
        ).to.be.revertedWith('invalid incentiveId')
      })

      //it('calculates the right secondsPerLiquidity')
      //it('does not overflow totalSecondsUnclaimed')
    })

    describe('fails if', () => {
      it('farm has already been exitFarming', async () => {
        await expect(subject(lpUser0)).to.revertedWith('ERC721: owner query for nonexistent token')
      })
    })
  })

  describe('liquidityIfOverflow', () => {
    const MAX_UINT_96 = BN('2').pow(BN('96')).sub(1)

    let incentive: HelperTypes.CreateIncentive.Result
    let incentiveId: string

    beforeEach(async () => {
      timestamps = makeTimestamps(1_000 + (await blockTimestamp()))
      incentive = await helpers.createIncentiveFlow({
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: context.poolObj.address,
        ...timestamps,
        rewardRate: BigNumber.from('10'),
        bonusRewardRate: BigNumber.from('50'),
      })
      incentiveId = await helpers.getIncentiveId(incentive)
      // await Time.setAndMine(timestamps.startTime + 1)
    })

    it('works when no overflow', async () => {
      // With this `amount`, liquidity ends up less than MAX_UINT96
      const amount = MAX_UINT_96.div(1000)

      const { tokenId } = await helpers.mintFlow({
        lp: lpUser0,
        tokens: [context.token0, context.token1],
        amounts: [amount, amount],
        tickLower: 0,
        tickUpper: 10 * TICK_SPACINGS[FeeAmount.MEDIUM],
      })

      await helpers.depositFlow({
        lp: lpUser0,
        tokenId,
      })

      await context.farmingCenter.connect(lpUser0).enterFarming(incentiveResultToFarmAdapter(incentive), tokenId)
      const farm = await context.eternalFarming.farms(tokenId, incentiveId)
      expect(farm.liquidity).to.be.lt(MAX_UINT_96)
    })

    it('works when overflow', async () => {
      // With this `amount`, liquidity ends up more than MAX_UINT96
      const amount = MAX_UINT_96.sub(100)
      const { tokenId } = await helpers.mintFlow({
        lp: lpUser0,
        tokens: [context.token0, context.token1],
        amounts: [amount, amount],
        tickLower: 0,
        tickUpper: 10 * TICK_SPACINGS[FeeAmount.MEDIUM],
      })

      await helpers.depositFlow({
        lp: lpUser0,
        tokenId,
      })

      await context.farmingCenter.connect(lpUser0).enterFarming(incentiveResultToFarmAdapter(incentive), tokenId)
      const farm = await context.eternalFarming.farms(tokenId, incentiveId)
      expect(farm.liquidity).to.be.gt(MAX_UINT_96)
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
        rewardRate: BigNumber.from('10000'),
        bonusRewardRate: BigNumber.from('50000'),
      }

      incentiveKey = {
        ...timestamps,
        rewardToken: context.rewardToken.address,
        bonusRewardToken: context.bonusRewardToken.address,

        pool: context.pool01,
      }

      virtualPool = (await helpers.createIncentiveFlow(incentiveArgs)).virtualPool
    })

    it('deactivate incentive', async () => {
      let activeIncentiveBefore = await context.poolObj.connect(incentiveCreator).activeIncentive()

      await context.eternalFarming.connect(incentiveCreator).deactivateIncentive(incentiveKey)
      let activeIncentiveAfter = await context.poolObj.connect(incentiveCreator).activeIncentive()

      expect(activeIncentiveBefore).to.equal(virtualPool.address)
      expect(activeIncentiveAfter).to.equal(ZERO_ADDRESS)
    })
  })

  describe('rewards', async () => {
    let incentiveArgs: HelperTypes.CreateIncentive.Args
    let incentiveKey: ContractParams.IncentiveKey
    let incentiveId: string

    beforeEach(async () => {
      /** We will be doing a lot of time-testing here, so leave some room between
        and when the incentive starts */
      bonusReward = BN(10000)
      timestamps = makeTimestamps(1_000 + (await blockTimestamp()))

      incentiveArgs = {
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: context.poolObj.address,
        ...timestamps,
        rewardRate: BigNumber.from('100'),
        bonusRewardRate: BigNumber.from('3'),
      }

      incentiveKey = {
        ...timestamps,
        rewardToken: context.rewardToken.address,
        bonusRewardToken: context.bonusRewardToken.address,

        pool: context.pool01,
      }

      incentiveId = await helpers.getIncentiveId(await helpers.createIncentiveFlow(incentiveArgs))
    })

    it('#addRewards', async () => {
      let incentiveBefore = await context.eternalFarming.connect(lpUser0).incentives(incentiveId)

      await erc20Helper.ensureBalancesAndApprovals(
        lpUser0,
        [context.rewardToken, context.bonusRewardToken],
        amountDesired,
        context.eternalFarming.address
      )

      await context.eternalFarming.connect(lpUser0).addRewards(incentiveKey, amountDesired, amountDesired)

      let incentiveAfter = await context.eternalFarming.connect(lpUser0).incentives(incentiveId)

      expect(incentiveAfter.totalReward.sub(amountDesired)).to.eq(incentiveBefore.totalReward)
      expect(incentiveAfter.bonusReward.sub(amountDesired)).to.eq(incentiveBefore.bonusReward)
    })

    it('#addRewards with 0 amounts', async () => {
      let incentiveBefore = await context.eternalFarming.connect(lpUser0).incentives(incentiveId)

      await erc20Helper.ensureBalancesAndApprovals(
        lpUser0,
        [context.rewardToken, context.bonusRewardToken],
        amountDesired,
        context.eternalFarming.address
      )

      await context.eternalFarming.connect(lpUser0).addRewards(incentiveKey, 0, 0)

      let incentiveAfter = await context.eternalFarming.connect(lpUser0).incentives(incentiveId)

      expect(incentiveAfter.totalReward).to.eq(incentiveBefore.totalReward)
      expect(incentiveAfter.bonusReward).to.eq(incentiveBefore.bonusReward)

      await context.eternalFarming.connect(lpUser0).addRewards(incentiveKey, 0, 1)
      incentiveAfter = await context.eternalFarming.connect(lpUser0).incentives(incentiveId)
      expect(incentiveAfter.totalReward).to.eq(incentiveBefore.totalReward)
      expect(incentiveAfter.bonusReward).to.eq(incentiveBefore.bonusReward.add(1))

      await context.eternalFarming.connect(lpUser0).addRewards(incentiveKey, 1, 0)
      incentiveAfter = await context.eternalFarming.connect(lpUser0).incentives(incentiveId)
      expect(incentiveAfter.totalReward).to.eq(incentiveBefore.totalReward.add(1))
      expect(incentiveAfter.bonusReward).to.eq(incentiveBefore.bonusReward.add(1))
    })

    it('#addRewards to non-existent incentive', async () => {
      incentiveKey = {
        ...timestamps,
        rewardToken: context.rewardToken.address,
        bonusRewardToken: context.bonusRewardToken.address,

        pool: context.pool12,
      }

      await expect(context.eternalFarming.connect(lpUser0).addRewards(incentiveKey, 0, 0)).to.be.revertedWithCustomError(
        context.eternalFarming as AlgebraEternalFarming,
        'incentiveNotExist'
      )
    })

    it('#setRates', async () => {
      await erc20Helper.ensureBalancesAndApprovals(lpUser0, [context.token0, context.token1], amountDesired, context.nft.address)

      tokenId = await mintPosition(context.nft.connect(lpUser0), {
        token0: context.token0.address,
        token1: context.token1.address,
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: lpUser0.address,
        amount0Desired: amountDesired,
        amount1Desired: amountDesired,
        amount0Min: 0,
        amount1Min: 0,
        deadline: (await blockTimestamp()) + 1000,
      })

      await context.nft.connect(lpUser0).approveForFarming(tokenId, true)

      context.farmingCenter.connect(lpUser0).enterFarming(
        {
          pool: context.pool01,
          rewardToken: context.rewardToken.address,
          bonusRewardToken: context.bonusRewardToken.address,
          ...timestamps,
        },
        tokenId
      )
      await context.eternalFarming.connect(incentiveCreator).setRates(incentiveKey, BN(60), BN(5))
      let rewardsBefore = await context.eternalFarming.getRewardInfo(incentiveKey, tokenId)
      let time = await blockTimestamp()

      await Time.set(time + 100)

      const trader = actors.traderUser0()

      await helpers.makeTickGoFlow({
        trader,
        direction: 'up',
        desiredValue: 10,
      })
      time = await blockTimestamp()
      let rewardsAfter = await context.eternalFarming.getRewardInfo(incentiveKey, tokenId)

      expect(rewardsAfter.reward.sub(rewardsBefore.reward)).to.eq(BN(60).mul(BN(104)))
      expect(rewardsAfter.bonusReward.sub(rewardsBefore.bonusReward)).to.eq(BN(5).mul(BN(104)))
    })
  })
})
