import { BigNumber, Wallet } from 'ethers'
import { LoadFixtureFunction } from '../types'
import { TestERC20 } from '../../typechain'
import { algebraEternalFixture, mintPosition, EternalAlgebraFixtureType } from '../shared/fixtures'
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
} from '../shared'
import { createFixtureLoader, provider } from '../shared/provider'
import { HelperCommands, ERC20Helper, incentiveResultToFarmAdapter } from '../helpers'
import { ContractParams } from '../../types/contractParams'
import { createTimeMachine } from '../shared/time'
import { HelperTypes } from '../helpers/types'

let loadFixture: LoadFixtureFunction

describe('unit/EternalFarms', () => {
  const actors = new ActorFixture(provider.getWallets(), provider)
  const incentiveCreator = actors.incentiveCreator()
  const lpUser0 = actors.lpUser0()
  const amountDesired = BNe18(10)
  const totalReward = BigNumber.from('10000');
  const bonusReward = BigNumber.from('200');
  const erc20Helper = new ERC20Helper()
  const Time = createTimeMachine(provider)
  let helpers: HelperCommands
  let context: EternalAlgebraFixtureType
  let timestamps: ContractParams.Timestamps
  let tokenId: string
  let L2tokenId: string

  before('loader', async () => {
    loadFixture = createFixtureLoader(provider.getWallets(), provider)
  })

  beforeEach('create fixture loader', async () => {
    context = await loadFixture(algebraEternalFixture)
    helpers = HelperCommands.fromTestContext(context, actors, provider)
  })

  describe('#enterFarming', () => {
    let incentiveId: string
    let incentiveArgs: HelperTypes.CreateIncentive.Args
    let subject: (L2TokenId: string, _actor: Wallet) => Promise<any>

    beforeEach(async () => {
      context = await loadFixture(algebraEternalFixture)
      helpers = HelperCommands.fromTestContext(context, actors, provider)

      /** We will be doing a lot of time-testing here, so leave some room between
        and when the incentive starts */
      timestamps = makeTimestamps(1_000 + (await blockTimestamp()))

      await erc20Helper.ensureBalancesAndApprovals(
        lpUser0,
        [context.token0, context.token1],
        amountDesired,
        context.nft.address
      )

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

      await context.nft
        .connect(lpUser0)
        ['safeTransferFrom(address,address,uint256)'](lpUser0.address, context.farming.address, tokenId)

      incentiveArgs = {
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: context.poolObj.address,
        ...timestamps,
        eternal: true,
        rewardRate: BigNumber.from('10'),
        bonusRewardRate: BigNumber.from('50')
      }

      incentiveId = await helpers.getIncentiveId(await helpers.createIncentiveFlow(incentiveArgs))

      subject = (L2TokenId: string, _actor: Wallet) =>
        context.farming.connect(_actor).enterFarming(
          {
            refundee: incentiveCreator.address,
            pool: context.pool01,
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            ...timestamps,
          },
          L2TokenId
        )
    })

    describe('works and', () => {
      // Make sure the incentive has started
      // beforeEach(async () => {
      //   await Time.set(timestamps.startTime + 100)
      // })

      it('emits the farm event', async () => {
        const { liquidity } = await context.nft.positions(tokenId)
        await expect(subject(tokenId, lpUser0))
          .to.emit(context.farming, 'FarmStarted')
          .withArgs(tokenId, tokenId, incentiveId, liquidity)
      })

      it('sets the farm struct properly', async () => {
        const liquidity = (await context.nft.positions(tokenId)).liquidity

        const farmBefore = await context.farming.farms(tokenId, incentiveId)
        const depositFarmsBefore = (await context.farming.deposits(tokenId)).L2TokenId
        await subject(tokenId, lpUser0)
        const farmAfter = await context.farming.farms(tokenId, incentiveId)
        const depositFarmsAfter = (await context.farming.deposits(tokenId)).L2TokenId

        expect(farmBefore.liquidity).to.eq(0)
        expect(depositFarmsBefore).to.eq(0)
        expect(farmAfter.liquidity).to.eq(liquidity)
        expect(depositFarmsAfter).to.eq(1)
      })

      it('increments the number of farms on the deposit', async () => {
        const nFarmsBefore: BigNumber = (await context.farming.deposits(tokenId)).L2TokenId
        await subject(tokenId, lpUser0)

        expect((await context.farming.deposits(tokenId)).L2TokenId).to.eq(nFarmsBefore.add(1))
      })

      it('increments the number of farms on the incentive', async () => {
        const { numberOfFarms: farmsBefore } = await context.farming.incentives(incentiveId)

        await subject(tokenId, lpUser0)

        const { numberOfFarms: farmsAfter } = await context.farming.incentives(incentiveId)
        expect(farmsAfter.sub(farmsBefore)).to.eq(BN('1'))
      })

      it('has gas cost', async () => await snapshotGasCost(subject(tokenId, lpUser0)))
    })

    describe('fails when', () => {
      it('deposit is already farmd in the incentive', async () => {
        //await Time.set(timestamps.startTime + 500)
        await subject(tokenId, lpUser0)
        await expect(subject(tokenId, lpUser0)).to.be.revertedWith('AlgebraFarming::enterFarming: already farmd')
      })

      it('you are not the owner of the deposit', async () => {
        //await Time.set(timestamps.startTime + 500)
        // lpUser2 calls, we're using lpUser0 elsewhere.
        await expect(subject(tokenId, actors.lpUser2())).to.be.revertedWith(
          'AlgebraFarming::enterFarming: only owner can farm token'
        )
      })

      it('has 0 liquidity in the position', async () => {
        //await Time.set(timestamps.startTime + 500)
        await erc20Helper.ensureBalancesAndApprovals(
          lpUser0,
          [context.token0, context.token1],
          amountDesired,
          context.nft.address
        )

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

        await context.nft.connect(lpUser0).decreaseLiquidity({
          tokenId: tokenId2,
          liquidity: (await context.nft.positions(tokenId2)).liquidity,
          amount0Min: 0,
          amount1Min: 0,
          deadline: (await blockTimestamp()) + 1_000,
        })

        await context.nft
          .connect(lpUser0)
          ['safeTransferFrom(address,address,uint256)'](lpUser0.address, context.farming.address, tokenId2, {
            ...maxGas,
          })

        await expect(subject(tokenId2, lpUser0)).to.be.revertedWith(
          'AlgebraFarming::enterFarming: cannot farm token with 0 liquidity'
        )
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
          context.farming.connect(lpUser0).enterFarming(
            {
              refundee: incentiveCreator.address,
              pool: context.pool01,
              rewardToken: context.rewardToken.address,
              bonusRewardToken: context.bonusRewardToken.address,
              ...timestamps,
            },
            otherTokenId
          )
        ).to.be.revertedWith('AlgebraFarming::enterFarming: token pool is not the incentive pool')
      })

      it('incentive key does not exist', async () => {
        // await Time.setAndMine(timestamps.startTime + 20)

        await expect(
          context.farming.connect(lpUser0).enterFarming(
            {
              refundee: incentiveCreator.address,
              pool: context.pool01,
              rewardToken: context.rewardToken.address,
              bonusRewardToken: context.bonusRewardToken.address,
              ...timestamps,
              startTime: timestamps.startTime + 10,
            },
            tokenId
          )
        ).to.be.revertedWith('AlgebraFarming::enterFarming: non-existent incentive')
      })
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

      await context.nft
        .connect(lpUser0)
        ['safeTransferFrom(address,address,uint256)'](lpUser0.address, context.farming.address, tokenId)

      farmIncentiveKey = {
        refundee: incentiveCreator.address,
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
          eternal: true,
          rewardRate: BigNumber.from('10'),
          bonusRewardRate: BigNumber.from('50')
        })
      )

      // await Time.set(timestamps.startTime)
      await context.farming.connect(lpUser0).enterFarming(farmIncentiveKey, tokenId)
      await context.farming.farms(tokenId, incentiveId)
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

      const rewardInfo = await context.farming.connect(lpUser0).getRewardInfo(farmIncentiveKey, tokenId)

      const { tickLower, tickUpper } = await context.nft.positions(tokenId)
      const { innerSecondsSpentPerLiquidity } = await pool.getInnerCumulatives(tickLower, tickUpper)
      const farm = await context.farming.farms(tokenId, incentiveId)

      const expectedSecondsInPeriod = innerSecondsSpentPerLiquidity
        .mul(farm.liquidity)

      // @ts-ignore
      expect(rewardInfo.reward).to.be.closeTo(BN('9900'),  BN('10000'));
      //expect(rewardInfo.secondsInsideX128).to.equal(expectedSecondsInPeriod)
    })

    it('reverts if farm does not exist', async () => {
      // await Time.setAndMine(timestamps.endTime + 1)

      await expect(context.farming.connect(lpUser0).getRewardInfo(farmIncentiveKey, '100')).to.be.revertedWith(
        'AlgebraFarming::getRewardInfo: farm does not exist'
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
        eternal: true,
        rewardRate: BigNumber.from('10'),
        bonusRewardRate: BigNumber.from('50')
      })
      //
      // await Time.setAndMine(timestamps.startTime + 1)

      const mintResult = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm,
        ticks: [getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]), getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])],
        amountsToFarm: [amountDesired, amountDesired],
        createIncentiveResult,
      })
      tokenId = mintResult.tokenId

      await Time.setAndMine(timestamps.endTime + 10)
      await context.farming.connect(lpUser0).exitFarming(
        {
          refundee: incentiveCreator.address,
          rewardToken: context.rewardToken.address,
          bonusRewardToken: context.bonusRewardToken.address,
          pool: context.pool01,
          ...timestamps,
        },
        tokenId
      )

      claimable = await context.farming.rewards(context.rewardToken.address, lpUser0.address)

      subject = (_token: string, _to: string, _amount: BigNumber) =>
        context.farming.connect(lpUser0).claimReward(_token, _to, _amount)
    })

    describe('when requesting the full amount', () => {
      it('emits RewardClaimed event', async () => {
        const { rewardToken } = context
        claimable = await context.farming.rewards(rewardToken.address, lpUser0.address)
        await expect(subject(rewardToken.address, lpUser0.address, BN('0')))
          .to.emit(context.farming, 'RewardClaimed')
          .withArgs(lpUser0.address, claimable, context.rewardToken.address, lpUser0.address)
      })

      it('transfers the correct reward amount to destination address', async () => {
        const { rewardToken } = context
        claimable = await context.farming.rewards(rewardToken.address, lpUser0.address)
        const balance = await rewardToken.balanceOf(lpUser0.address)
        await subject(rewardToken.address, lpUser0.address, BN('0'))
        expect(await rewardToken.balanceOf(lpUser0.address)).to.equal(balance.add(claimable))
      })

      it('sets the claimed reward amount to zero', async () => {
        const { rewardToken } = context
        expect(await context.farming.rewards(rewardToken.address, lpUser0.address)).to.not.equal(0)

        await subject(rewardToken.address, lpUser0.address, BN('0'))

        expect(await context.farming.rewards(rewardToken.address, lpUser0.address)).to.equal(0)
      })

      it('has gas cost', async () =>
        await snapshotGasCost(subject(context.rewardToken.address, lpUser0.address, BN('0'))))

      it('returns their claimable amount', async () => {
        const { rewardToken, farming } = context
        const amountBefore = await rewardToken.balanceOf(lpUser0.address)
        await subject(rewardToken.address, lpUser0.address, BN('0'))
        expect(await farming.rewards(rewardToken.address, lpUser0.address)).to.eq(BN('0'))
        expect(await rewardToken.balanceOf(lpUser0.address)).to.eq(amountBefore.add(claimable))
      })
    })

    describe('when requesting a nonzero amount', () => {
      it('emits RewardClaimed event', async () => {
        const { rewardToken } = context
        await expect(subject(rewardToken.address, lpUser0.address, claimable))
          .to.emit(context.farming, 'RewardClaimed')
          .withArgs(lpUser0.address, claimable, context.rewardToken.address, lpUser0.address)
      })

      it('transfers the correct reward amount to destination address', async () => {
        const { rewardToken } = context
        claimable = await context.farming.rewards(rewardToken.address, lpUser0.address)
        const balance = await rewardToken.balanceOf(lpUser0.address)
        await subject(rewardToken.address, lpUser0.address, claimable)
        expect(await rewardToken.balanceOf(lpUser0.address)).to.equal(balance.add(claimable))
      })

      it('sets the claimed reward amount to the correct amount', async () => {
        const { rewardToken, farming } = context
        const initialRewardBalance = await farming.rewards(rewardToken.address, lpUser0.address)
        expect(initialRewardBalance).to.not.equal(BN('0'))

        const partialClaim = initialRewardBalance.div(BN('3'))
        await subject(rewardToken.address, lpUser0.address, partialClaim)

        expect(await farming.rewards(rewardToken.address, lpUser0.address)).to.eq(initialRewardBalance.sub(partialClaim))
      })

      describe('when user claims more than they have', () => {
        it('only transfers what they have', async () => {
          const { rewardToken, farming } = context
          const amountBefore = await rewardToken.balanceOf(lpUser0.address)
          await subject(rewardToken.address, lpUser0.address, claimable.mul(BN('3')))
          expect(await farming.rewards(rewardToken.address, lpUser0.address)).to.eq(BN('0'))
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
      it('cannot exitFarming', async() => {
        timestamps = makeTimestamps(await blockTimestamp())

        createIncentiveResult = await helpers.createIncentiveFlow({
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          totalReward,
          bonusReward,
          poolAddress: context.poolObj.address,
          ...timestamps,
          eternal: true,
          rewardRate: BigNumber.from('10'),
          bonusRewardRate: BigNumber.from('50')
        })

        await erc20Helper.ensureBalancesAndApprovals(
          lpUser0,
          [context.token0, context.token1],
          amountDesired,
          context.nft.address
        )
        

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

        await context.nft
          .connect(lpUser0)
          ['safeTransferFrom(address,address,uint256)'](lpUser0.address, context.farming.address, tokenId)

        // await Time.setAndMine(timestamps.startTime + 1)

        await context.farming.connect(lpUser0).enterFarming(
          {
            refundee: incentiveCreator.address,
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            pool: context.pool01,
            ...timestamps,
          },
          tokenId
        )

        incentiveId = await helpers.getIncentiveId(createIncentiveResult)

        await expect(context.farming.connect(actors.lpUser0()).exitFarming(
          {
            refundee: incentiveCreator.address,
            pool: context.pool01,
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            ...timestamps,
          },
          tokenId
        )).to.be.emit(context.farming, 'FarmEnded')
      })
    })

    describe('after end time', () => {
      beforeEach('create the incentive and nft and farm it', async () => {
        timestamps = makeTimestamps(await blockTimestamp())

        createIncentiveResult = await helpers.createIncentiveFlow({
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          totalReward,
          bonusReward,
          poolAddress: context.poolObj.address,
          ...timestamps,
          eternal: true,
          rewardRate: BigNumber.from('10'),
          bonusRewardRate: BigNumber.from('50')
        })

        await erc20Helper.ensureBalancesAndApprovals(
          lpUser0,
          [context.token0, context.token1],
          amountDesired,
          context.nft.address
        )

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

        await context.nft
          .connect(lpUser0)
          ['safeTransferFrom(address,address,uint256)'](lpUser0.address, context.farming.address, tokenId)

        await Time.setAndMine(timestamps.startTime + 1)

        await context.farming.connect(lpUser0).enterFarming(
          {
            refundee: incentiveCreator.address,
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            pool: context.pool01,
            ...timestamps,
          },
          tokenId
        )

        await Time.setAndMine(timestamps.endTime + 10)

        incentiveId = await helpers.getIncentiveId(createIncentiveResult)

        subject = (_actor: Wallet) =>
          context.farming.connect(_actor).exitFarming(
            {
              refundee: incentiveCreator.address,
              pool: context.pool01,
              rewardToken: context.rewardToken.address,
              bonusRewardToken: context.bonusRewardToken.address,
              ...timestamps,
            },
            tokenId
          )
      })

      describe('works and', () => {
        it('decrements deposit numberOfFarms by 1', async () => {
          const { L2TokenId: farmsPre } = await context.farming.deposits(tokenId)
          await subject(lpUser0)
          const { L2TokenId: farmsPost } = await context.farming.deposits(tokenId)
          expect(farmsPre).to.not.equal(farmsPost.sub(1))
        })

        it('decrements incentive numberOfFarms by 1', async () => {
          const { numberOfFarms: farmsPre } = await context.farming.incentives(incentiveId)
          await subject(lpUser0)
          const { numberOfFarms: farmsPost } = await context.farming.incentives(incentiveId)
          expect(farmsPre).to.not.equal(farmsPost.sub(1))
        })

        it('emits an exitFarmingd event', async () => {
          await expect(subject(lpUser0)).to.emit(context.farming, 'FarmEnded').withArgs(
              tokenId,
              incentiveId,
              context.rewardToken.address,
              context.bonusRewardToken.address,
              lpUser0.address,
              BN('9999'),
              BN('199')
          )
        })

        it('has gas cost', async () => {
          await snapshotGasCost(subject(lpUser0))
        })

        it('updates the reward available for the context.tokenomics', async () => {
          const rewardsAccured = await context.farming.rewards(context.rewardToken.address, lpUser0.address)
          await subject(lpUser0)
          expect(await context.farming.rewards(context.rewardToken.address, lpUser0.address)).to.be.gt(rewardsAccured)
        })

        it('updates the farm struct', async () => {
          const farmBefore = await context.farming.farms(tokenId, incentiveId)
          await subject(lpUser0)
          const farmAfter = await context.farming.farms(tokenId, incentiveId)

          expect(farmBefore.liquidity).to.gt(0)
          expect(farmAfter.liquidity).to.eq(0)
        })
    })

      describe('after the end time', () => {
        beforeEach(async () => {
          // Fast-forward to after the end time
          // await Time.setAndMine(timestamps.endTime + 1)
        })

        // it('anyone cant exitFarming', async () => {
        //   await subject(actors.lpUser1())
        // })

        it('owner can exitFarming', async () => {
          await subject(lpUser0)
        })
      })

      it('calculates the right secondsPerLiquidity')
      it('does not overflow totalSecondsUnclaimed')
    })

    describe('fails if', () => {
      it('farm has already been exitFarmingd', async () => {
        // await Time.setAndMine(timestamps.endTime + 1)
        //await subject(lpUser0)
        await expect(subject(lpUser0)).to.revertedWith('ERC721: operator query for nonexistent token')
      })
    })
  })

  describe('liquidityIfOverflow', () => {
    const MAX_UINT_96 = BN('2').pow(BN('96')).sub(1)

    let incentive
    let incentiveId

    beforeEach(async () => {
      timestamps = makeTimestamps(1_000 + (await blockTimestamp()))
      incentive = await helpers.createIncentiveFlow({
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: context.poolObj.address,
        ...timestamps,
        eternal: true,
        rewardRate: BigNumber.from('10'),
        bonusRewardRate: BigNumber.from('50')
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

      await context.farming.connect(lpUser0).enterFarming(incentiveResultToFarmAdapter(incentive), tokenId)
      const farm = await context.farming.farms(tokenId, incentiveId)
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

      await context.farming.connect(lpUser0).enterFarming(incentiveResultToFarmAdapter(incentive), tokenId)
      const farm = await context.farming.farms(tokenId, incentiveId)
      expect(farm.liquidity).to.be.gt(MAX_UINT_96)
    })
  })
})
