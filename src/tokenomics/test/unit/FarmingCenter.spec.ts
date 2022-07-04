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

const LIMIT_FARMING = true;
const ETERNAL_FARMING = false;

describe('unit/FarmingCenter', () => {
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

  describe('#Enter ParallelFarmings', () => {
    let incentiveIdEternal: string
    let incentiveId: string
    let incentiveArgsEternal: HelperTypes.CreateIncentive.Args
    let incentiveArgs: HelperTypes.CreateIncentive.Args
    let subjectEternal: (L2TokenId: string, _actor: Wallet) => Promise<any>
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
        ['safeTransferFrom(address,address,uint256)'](lpUser0.address, context.farmingCenter.address, tokenId)

      incentiveArgsEternal = {
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

      incentiveIdEternal = await helpers.getIncentiveId(await helpers.createIncentiveFlow(incentiveArgsEternal))


      incentiveArgs = {
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: context.poolObj.address,
        ...timestamps,
      }

      incentiveId = await helpers.getIncentiveId(await helpers.createIncentiveFlow(incentiveArgs))

      subjectEternal = (L2TokenId: string, _actor: Wallet) =>
        context.farmingCenter.connect(_actor).enterFarming(
          {
            
            pool: context.pool01,
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            ...timestamps,
          },
          L2TokenId,
          0,
          ETERNAL_FARMING
        )

      subject = (L2TokenId: string, _actor: Wallet) =>
        context.farmingCenter.connect(_actor).enterFarming(
          {
            pool: context.pool01,
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            ...timestamps,
          },
          L2TokenId,
          0,
          LIMIT_FARMING
        )
    })

    describe('works and', () => {
      // Make sure the incentive has started
      //beforeEach(async () => {
      //   await Time.set(timestamps.startTime + 100)
      //})

      it('emits the farm event', async () => {
        const { liquidity } = await context.nft.positions(tokenId)

        await expect(subject(tokenId, lpUser0))
        .to.emit(context.incentiveFarming, 'FarmStarted')
        .withArgs(tokenId, incentiveId, liquidity, 0)

        await expect(subjectEternal(tokenId, lpUser0))
          .to.emit(context.farming, 'FarmStarted')
          .withArgs(tokenId, incentiveIdEternal, liquidity, 0)
      })

      it('sets the farm struct properly', async () => {
        const liquidityEternal = (await context.nft.positions(tokenId)).liquidity

        const farmBeforeEternal = await context.farming.farms(tokenId, incentiveIdEternal)
        const depositFarmsBeforeEternal = (await context.farmingCenter.deposits(tokenId)).L2TokenId
        await subjectEternal(tokenId, lpUser0)
        const farmAfterEternal = await context.farming.farms(tokenId, incentiveIdEternal)
        const depositFarmsAfterEternal = (await context.farmingCenter.deposits(tokenId)).L2TokenId

        expect(farmBeforeEternal.liquidity).to.eq(0)
        expect(depositFarmsBeforeEternal).to.eq(1)
        expect(farmAfterEternal.liquidity).to.eq(liquidityEternal)
        expect(depositFarmsAfterEternal).to.eq(1)

        const liquidity = (await context.nft.positions(tokenId)).liquidity

        const farmBefore = await context.incentiveFarming.farms(tokenId, incentiveId)
        const depositFarmsBefore = (await context.farmingCenter.deposits(tokenId)).L2TokenId
        await subject(tokenId, lpUser0)
        const farmAfter = await context.incentiveFarming.farms(tokenId, incentiveId)
        const depositFarmsAfter = (await context.farmingCenter.deposits(tokenId)).L2TokenId

        expect(farmBefore.liquidity).to.eq(0)
        expect(depositFarmsBefore).to.eq(1)
        expect(farmAfter.liquidity).to.eq(liquidity)
        expect(depositFarmsAfter).to.eq(1)
      })

      it('increments the number of farms on the deposit', async () => {
        const nFarmsBefore: BigNumber = BigNumber.from((await context.farmingCenter.deposits(tokenId)).numberOfFarms)
        await subject(tokenId, lpUser0)
        await subjectEternal(tokenId, lpUser0)

        expect((await context.farmingCenter.deposits(tokenId)).numberOfFarms).to.eq(nFarmsBefore.add(2))
      })

      it('has gas cost', async () => await snapshotGasCost(subject(tokenId, lpUser0)))
    })

    describe('fails when', () => {
      it('deposit is already farmd in the incentive', async () => {
        //await Time.set(timestamps.startTime + 500)
        await subject(tokenId, lpUser0)
        await expect(subject(tokenId, lpUser0)).to.be.revertedWith('token already farmed')
        await subjectEternal(tokenId, lpUser0)
        await expect(subjectEternal(tokenId, lpUser0)).to.be.revertedWith('AlgebraFarming::enterFarming: token already farmed')
      })

      it('you are not the owner of the deposit', async () => {
        //await Time.set(timestamps.startTime + 500)
        // lpUser2 calls, we're using lpUser0 elsewhere.
        await expect(subject(tokenId, actors.lpUser2())).to.be.revertedWith(
          'Not approved'
        )
        await expect(subjectEternal(tokenId, actors.lpUser2())).to.be.revertedWith(
          'Not approved'
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
          ['safeTransferFrom(address,address,uint256)'](lpUser0.address, context.farmingCenter.address, tokenId2, {
            ...maxGas,
          })

        await expect(subject(tokenId2, lpUser0)).to.be.revertedWith(
          'AlgebraFarming::enterFarming: cannot farm token with 0 liquidity'
        )

        
        await expect(subjectEternal(tokenId2, lpUser0)).to.be.revertedWith(
          'AlgebraFarming::enterFarming: cannot farm token with 0 liquidity'
        )
      })

      it('token id is for a different pool than the incentive', async () => {
        const incentive2Eternal = await helpers.createIncentiveFlow({
          ...incentiveArgsEternal,
          poolAddress: context.pool12,
        })
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
            otherTokenId,
            0,
            ETERNAL_FARMING
          )
        ).to.be.revertedWith('AlgebraFarming::enterFarming: invalid pool for token')

        await expect(
          context.farmingCenter.connect(lpUser0).enterFarming(
            {
              
              pool: context.pool01,
              rewardToken: context.rewardToken.address,
              bonusRewardToken: context.bonusRewardToken.address,
              ...timestamps,
            },
            otherTokenId,
            0,
            LIMIT_FARMING
          )
        ).to.be.revertedWith('AlgebraFarming::enterFarming: invalid pool for token')
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
            tokenId,
            0,
            ETERNAL_FARMING
          )
        ).to.be.revertedWith('AlgebraFarming::enterFarming: non-existent incentive')

        await expect(
          context.farmingCenter.connect(lpUser0).enterFarming(
            {
              
              pool: context.pool01,
              rewardToken: context.rewardToken.address,
              bonusRewardToken: context.bonusRewardToken.address,
              ...timestamps,
              startTime: timestamps.startTime + 10,
            },
            tokenId,
            0,
            LIMIT_FARMING
          )
        ).to.be.revertedWith('AlgebraFarming::enterFarming: non-existent incentive')
      })
    })
  })

  describe('swap gas', async () => {
    it('3 swaps', async () => {
      timestamps = makeTimestamps((await blockTimestamp()) + 1_000)

      const mintResult = await helpers.mintFlow({
        lp: lpUser0,
        tokens: [context.token0, context.token1],
      })
      tokenId = mintResult.tokenId

      await context.nft
        .connect(lpUser0)
        ['safeTransferFrom(address,address,uint256)'](lpUser0.address, context.farmingCenter.address, tokenId)

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
          eternal: true,
          rewardRate: BigNumber.from('10'),
          bonusRewardRate: BigNumber.from('50')
        })
      )

      let incentiveId = await helpers.getIncentiveId(
        await helpers.createIncentiveFlow({
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          totalReward,
          bonusReward,
          poolAddress: context.poolObj.address,
          ...timestamps
        })
      )

      // await Time.set(timestamps.startTime)
      await context.farmingCenter.connect(lpUser0).enterFarming(farmIncentiveKey, tokenId, 0, ETERNAL_FARMING)
      await context.farmingCenter.connect(lpUser0).enterFarming(farmIncentiveKey, tokenId, 0, LIMIT_FARMING)
      await context.farming.farms(tokenId, incentiveId)

      const pool = context.poolObj.connect(actors.lpUser0())

      Time.set(timestamps.startTime + 10)
      //await provider.send('evm_mine', [timestamps.startTime + 100])
      const trader = actors.traderUser0()
      await snapshotGasCost(helpers.makeSwapGasCHeckFlow({
          trader,
          direction: 'up',
          desiredValue: 10,
      }))
      await snapshotGasCost(helpers.makeSwapGasCHeckFlow({
        trader,
        direction: 'up',
        desiredValue: 10,
      }))
      await snapshotGasCost(helpers.makeSwapGasCHeckFlow({
        trader,
        direction: 'up',
        desiredValue: 10,
      }))
    })
  })

  describe('#Parallel getRewardInfo', () => {
    let incentiveId: string
    let incentiveIdEternal: string
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
        ['safeTransferFrom(address,address,uint256)'](lpUser0.address, context.farmingCenter.address, tokenId)

      farmIncentiveKey = {
        
        rewardToken: context.rewardToken.address,
        bonusRewardToken: context.bonusRewardToken.address,
        pool: context.pool01,
        ...timestamps,
      }

      incentiveIdEternal = await helpers.getIncentiveId(
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

      incentiveId = await helpers.getIncentiveId(
        await helpers.createIncentiveFlow({
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          totalReward,
          bonusReward,
          poolAddress: context.poolObj.address,
          ...timestamps
        })
      )

      // await Time.set(timestamps.startTime)
      await context.farmingCenter.connect(lpUser0).enterFarming(farmIncentiveKey, tokenId, 0, ETERNAL_FARMING)
      await context.farmingCenter.connect(lpUser0).enterFarming(farmIncentiveKey, tokenId, 0, LIMIT_FARMING)
      await context.farming.farms(tokenId, incentiveIdEternal)
      await context.incentiveFarming.farms(tokenId, incentiveId)
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

      const rewardInfo = await context.incentiveFarming.connect(lpUser0).getRewardInfo(farmIncentiveKey, tokenId)

      const { tickLower, tickUpper } = await context.nft.positions(tokenId)
      const { innerSecondsSpentPerLiquidity } = await pool.getInnerCumulatives(tickLower, tickUpper)
      const farm = await context.incentiveFarming.farms(tokenId, incentiveId)

      const expectedSecondsInPeriod = innerSecondsSpentPerLiquidity
        .mul(farm.liquidity)

      // @ts-ignore
      expect(rewardInfo.reward).to.be.closeTo(BN('9900'),  BN('10000'));

      const rewardInfoEternal = await context.farming.connect(lpUser0).getRewardInfo(farmIncentiveKey, tokenId)

      const { tickLower: tickLowerEternal, tickUpper: tickUpperEternal } = await context.nft.positions(tokenId)
      const { innerSecondsSpentPerLiquidity: innerSecondsSpentPerLiquidityEternal } = 
        await pool.getInnerCumulatives(tickLowerEternal, tickUpperEternal)
      const farmEternal = await context.farming.farms(tokenId, incentiveIdEternal)

      const expectedSecondsInPeriodEternal = innerSecondsSpentPerLiquidityEternal
        .mul(farmEternal.liquidity)

      // @ts-ignore
      expect(rewardInfoEternal.reward).to.be.closeTo(BN('9900'),  BN('10000'));
      //expect(rewardInfo.secondsInsideX128).to.equal(expectedSecondsInPeriod)
    })

    it('reverts if farm does not exist', async () => {
      // await Time.setAndMine(timestamps.endTime + 1)

      await expect(context.farming.connect(lpUser0).getRewardInfo(farmIncentiveKey, '100')).to.be.revertedWith(
        'AlgebraFarming::getRewardInfo: farm does not exist'
      )

      await expect(context.incentiveFarming.connect(lpUser0).getRewardInfo(farmIncentiveKey, '100')).to.be.revertedWith(
        'AlgebraFarming::getRewardInfo: farm does not exist'
      )
    })
  })

  describe('#Parallel claimReward', () => {
    let createIncentiveResult: HelperTypes.CreateIncentive.Result
    let createIncentiveResultEternal: HelperTypes.CreateIncentive.Result
    let subject: (token: string, to: string, amount: BigNumber) => Promise<any>
    let subjectEternal: (token: string, to: string, amount: BigNumber) => Promise<any>
    // The amount the user should be able to claim
    let claimable: BigNumber
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
        eternal: true,
        rewardRate: BigNumber.from('10'),
        bonusRewardRate: BigNumber.from('50')
      })

      createIncentiveResult = await helpers.createIncentiveFlow({
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: context.poolObj.address,
        ...timestamps
      })

      const mintResult = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm,
        ticks: [getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]), getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])],
        amountsToFarm: [amountDesired, amountDesired],
        createIncentiveResult
      })
      tokenId = mintResult.tokenId

      await Time.setAndMine(timestamps.startTime + 1)

      const mintResultEternal = await helpers.mintDepositFarmFlow({
        lp: lpUser0,
        tokensToFarm,
        ticks: [getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]), getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])],
        amountsToFarm: [amountDesired, amountDesired],
        createIncentiveResult: createIncentiveResultEternal,
        eternal: true
      })
      tokenIdEternal = mintResultEternal.tokenId

      const trader = actors.traderUser0()
      await helpers.makeTickGoFlow({
          trader,
          direction: 'up',
          desiredValue: 10,
      })

      await Time.setAndMine(timestamps.endTime + 10)
      await context.farmingCenter.connect(lpUser0).exitFarming(
        {
          
          rewardToken: context.rewardToken.address,
          bonusRewardToken: context.bonusRewardToken.address,
          pool: context.pool01,
          ...timestamps,
        },
        tokenId,
        LIMIT_FARMING
      )

      await context.farmingCenter.connect(lpUser0).exitFarming(
        {
          
          rewardToken: context.rewardToken.address,
          bonusRewardToken: context.bonusRewardToken.address,
          pool: context.pool01,
          ...timestamps,
        },
        tokenIdEternal,
        ETERNAL_FARMING
      )

      claimable = await context.incentiveFarming.rewards(context.rewardToken.address, lpUser0.address)
      claimableEternal = await context.farming.rewards(context.rewardToken.address, lpUser0.address)

      subject = (_token: string, _to: string, _amount: BigNumber) =>
        context.incentiveFarming.connect(lpUser0).claimReward(_token, _to, _amount)

      subjectEternal = (_token: string, _to: string, _amount: BigNumber) =>
        context.farming.connect(lpUser0).claimReward(_token, _to, _amount)
    })

    describe('when requesting the full amount', () => {
      it('collects fees', async () => {
        const { rewardToken } = context
        const balance0Before = await context.token0.balanceOf(lpUser0.address);
        const balance1Before = await context.token1.balanceOf(lpUser0.address);

         await context.farmingCenter.connect(lpUser0).collect({
          tokenId: Number(tokenId),
          recipient: lpUser0.address,
          amount0Max: BN('10').pow(BN('18')),
          amount1Max: BN('10').pow(BN('18'))
        })

        const balance0After = await context.token0.balanceOf(lpUser0.address);
        const balance1After = await context.token1.balanceOf(lpUser0.address);

        //expect(balance0After).to.be.gt(balance0Before);
        expect(balance1After).to.be.gt(balance1Before);
      })

      it('emits RewardClaimed event', async () => {
        const { rewardToken } = context
        claimableEternal = await context.farming.rewards(rewardToken.address, lpUser0.address)
        await expect(subjectEternal(rewardToken.address, lpUser0.address, BN('0')))
          .to.emit(context.farming, 'RewardClaimed')
          .withArgs(lpUser0.address, claimableEternal, context.rewardToken.address, lpUser0.address)

        claimable = await context.incentiveFarming.rewards(rewardToken.address, lpUser0.address)
          await expect(subject(rewardToken.address, lpUser0.address, BN('0')))
            .to.emit(context.incentiveFarming, 'RewardClaimed')
            .withArgs(lpUser0.address, claimable, context.rewardToken.address, lpUser0.address)
      })

      it('transfers the correct reward amount to destination address', async () => {
        const { rewardToken } = context
        claimable = await context.incentiveFarming.rewards(rewardToken.address, lpUser0.address)
        const balance = await rewardToken.balanceOf(lpUser0.address)
        await subject(rewardToken.address, lpUser0.address, BN('0'))
        expect(await rewardToken.balanceOf(lpUser0.address)).to.equal(balance.add(claimable))

        claimableEternal = await context.farming.rewards(rewardToken.address, lpUser0.address)
        await subjectEternal(rewardToken.address, lpUser0.address, BN('0'))
        
        expect(await rewardToken.balanceOf(lpUser0.address)).to.equal(balance.add(claimable).add(claimableEternal))
      })

      it('sets the claimed reward amount to zero', async () => {
        const { rewardToken } = context
        expect(await context.incentiveFarming.rewards(rewardToken.address, lpUser0.address)).to.not.equal(0)
        expect(await context.farming.rewards(rewardToken.address, lpUser0.address)).to.not.equal(0)

        await subject(rewardToken.address, lpUser0.address, BN('0'))

        expect(await context.incentiveFarming.rewards(rewardToken.address, lpUser0.address)).to.equal(0)

        expect(await context.farming.rewards(rewardToken.address, lpUser0.address)).to.not.equal(0)

        await subjectEternal(rewardToken.address, lpUser0.address, BN('0'))

        expect(await context.farming.rewards(rewardToken.address, lpUser0.address)).to.equal(0)
      })

      it('has gas cost', async () =>{
        await snapshotGasCost(subject(context.rewardToken.address, lpUser0.address, BN('0')))
        await snapshotGasCost(subjectEternal(context.rewardToken.address, lpUser0.address, BN('0')))
      })

      it('returns their claimable amount', async () => {
        const { rewardToken, farming, incentiveFarming } = context
        const amountBefore = await rewardToken.balanceOf(lpUser0.address)
        await subject(rewardToken.address, lpUser0.address, BN('0'))
        expect(await incentiveFarming.rewards(rewardToken.address, lpUser0.address)).to.eq(BN('0'))
        expect(await rewardToken.balanceOf(lpUser0.address)).to.eq(amountBefore.add(claimable))

        const amountAfter = await rewardToken.balanceOf(lpUser0.address)
        await subjectEternal(rewardToken.address, lpUser0.address, BN('0'))
        expect(await farming.rewards(rewardToken.address, lpUser0.address)).to.eq(BN('0'))
        expect(await rewardToken.balanceOf(lpUser0.address)).to.eq(amountAfter.add(claimableEternal))
      })
    })

    describe('when requesting a nonzero amount', () => {
      it('emits RewardClaimed event', async () => {
        const { rewardToken } = context
        await expect(subject(rewardToken.address, lpUser0.address, claimable))
          .to.emit(context.incentiveFarming, 'RewardClaimed')
          .withArgs(lpUser0.address, claimable, context.rewardToken.address, lpUser0.address)

        await expect(subjectEternal(rewardToken.address, lpUser0.address, claimableEternal))
          .to.emit(context.farming, 'RewardClaimed')
          .withArgs(lpUser0.address, claimableEternal, context.rewardToken.address, lpUser0.address)
      })

      it('transfers the correct reward amount to destination address', async () => {
        const { rewardToken } = context
        claimable = await context.incentiveFarming.rewards(rewardToken.address, lpUser0.address)
        claimableEternal = await context.farming.rewards(rewardToken.address, lpUser0.address)

        const balance = await rewardToken.balanceOf(lpUser0.address)
        await subject(rewardToken.address, lpUser0.address, claimable)
        await subjectEternal(rewardToken.address, lpUser0.address, claimableEternal)
        expect(await rewardToken.balanceOf(lpUser0.address)).to.equal(balance.add(claimable).add(claimableEternal))
      })

      it('sets the claimed reward amount to the correct amount', async () => {
        const { rewardToken, farming, incentiveFarming } = context
        const initialRewardBalance = await incentiveFarming.rewards(rewardToken.address, lpUser0.address)
        const initialRewardBalanceEternal = await farming.rewards(rewardToken.address, lpUser0.address)
        expect(initialRewardBalance).to.not.equal(BN('0'))
        expect(initialRewardBalanceEternal).to.not.equal(BN('0'))

        const partialClaim = initialRewardBalance.div(BN('3'))
        const partialClaimEternal = initialRewardBalanceEternal.div(BN('3'))

        await subject(rewardToken.address, lpUser0.address, partialClaim)
        await subjectEternal(rewardToken.address, lpUser0.address, partialClaimEternal)

        expect(await incentiveFarming.rewards(rewardToken.address, lpUser0.address)).to.eq(initialRewardBalance.sub(partialClaim))
        expect(await farming.rewards(rewardToken.address, lpUser0.address)).to.eq(initialRewardBalanceEternal.sub(partialClaimEternal))
      })

      describe('when user claims more than they have', () => {
        it('only transfers what they have', async () => {
          const { rewardToken, farming, incentiveFarming } = context
          const amountBefore = await rewardToken.balanceOf(lpUser0.address)

          await subject(rewardToken.address, lpUser0.address, claimable.mul(BN('3')))
          await subjectEternal(rewardToken.address, lpUser0.address, claimableEternal.mul(BN('3')))

          expect(await incentiveFarming.rewards(rewardToken.address, lpUser0.address)).to.eq(BN('0'))
          expect(await farming.rewards(rewardToken.address, lpUser0.address)).to.eq(BN('0'))
          expect(await rewardToken.balanceOf(lpUser0.address)).to.eq(amountBefore.add(claimable).add(claimableEternal))
        })
      })
    })
  })

  describe('#Parallel exitFarming', () => {
    let incentiveId: string
    let incentiveIdEternal: string
    let subject: (actor: Wallet) => Promise<any>
    let subjectEternal: (actor: Wallet) => Promise<any>
    let createIncentiveResult: HelperTypes.CreateIncentive.Result
    let createIncentiveResultEternal: HelperTypes.CreateIncentive.Result

    describe('before end time', () => {
      it('can exitEternalFarming', async() => {
        timestamps = makeTimestamps(await blockTimestamp())

        createIncentiveResultEternal = await helpers.createIncentiveFlow({
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

        createIncentiveResult = await helpers.createIncentiveFlow({
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          totalReward,
          bonusReward,
          poolAddress: context.poolObj.address,
          ...timestamps
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
          ['safeTransferFrom(address,address,uint256)'](lpUser0.address, context.farmingCenter.address, tokenId)

        

        await context.farmingCenter.connect(lpUser0).enterFarming(
          {
            
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            pool: context.pool01,
            ...timestamps,
          },
          tokenId,
          0,
          ETERNAL_FARMING
        )

        await context.farmingCenter.connect(lpUser0).enterFarming(
          {
            
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            pool: context.pool01,
            ...timestamps,
          },
          tokenId,
          0,
          LIMIT_FARMING
        )
        await Time.setAndMine(timestamps.startTime + 1)
        incentiveIdEternal = await helpers.getIncentiveId(createIncentiveResultEternal)

        await expect(context.farmingCenter.connect(actors.lpUser0()).exitFarming(
          {
            
            pool: context.pool01,
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            ...timestamps,
          },
          tokenId,
          ETERNAL_FARMING
        )).to.be.emit(context.farming, 'FarmEnded')

        await expect(context.farmingCenter.connect(actors.lpUser0()).exitFarming(
          {
            
            pool: context.pool01,
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            ...timestamps,
          },
          tokenId,
          LIMIT_FARMING
        )).to.revertedWith('AlgebraFarming::exitFarming: cannot exitFarming before end time')
      })
    })

    describe('after end time', () => {
      beforeEach('create the incentive and nft and farm it', async () => {
        timestamps = makeTimestamps(await blockTimestamp())

        createIncentiveResultEternal = await helpers.createIncentiveFlow({
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

        createIncentiveResult = await helpers.createIncentiveFlow({
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          totalReward,
          bonusReward,
          poolAddress: context.poolObj.address,
          ...timestamps
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
          ['safeTransferFrom(address,address,uint256)'](lpUser0.address, context.farmingCenter.address, tokenId)

        await context.farmingCenter.connect(lpUser0).enterFarming(
            {
              
              rewardToken: context.rewardToken.address,
              bonusRewardToken: context.bonusRewardToken.address,
              pool: context.pool01,
              ...timestamps,
            },
            tokenId,
            0,
            LIMIT_FARMING
        )

        await Time.setAndMine(timestamps.startTime + 1)

        await context.farmingCenter.connect(lpUser0).enterFarming(
          {
            
            rewardToken: context.rewardToken.address,
            bonusRewardToken: context.bonusRewardToken.address,
            pool: context.pool01,
            ...timestamps,
          },
          tokenId,
          0,
          ETERNAL_FARMING
        )



        await Time.setAndMine(timestamps.endTime + 10)

        incentiveId = await helpers.getIncentiveId(createIncentiveResult)
        incentiveIdEternal = await helpers.getIncentiveId(createIncentiveResultEternal)

        subjectEternal = (_actor: Wallet) =>
          context.farmingCenter.connect(_actor).exitFarming(
            {
              
              pool: context.pool01,
              rewardToken: context.rewardToken.address,
              bonusRewardToken: context.bonusRewardToken.address,
              ...timestamps,
            },
            tokenId,
            ETERNAL_FARMING
          )

        subject = (_actor: Wallet) =>
          context.farmingCenter.connect(_actor).exitFarming(
            {
              
              pool: context.pool01,
              rewardToken: context.rewardToken.address,
              bonusRewardToken: context.bonusRewardToken.address,
              ...timestamps,
            },
            tokenId,
            LIMIT_FARMING
          )
      })

      describe('works and', () => {
        it('decrements deposit numberOfFarms by 1', async () => {
          const { numberOfFarms: farmsPre } = await context.farmingCenter.deposits(tokenId)
          await subject(lpUser0)
          const { numberOfFarms: farmsPost } = await context.farmingCenter.deposits(tokenId)
          expect(farmsPost).to.equal(farmsPre - 1)
          await subjectEternal(lpUser0)
          const { numberOfFarms: farmsPost2 } = await context.farmingCenter.deposits(tokenId)
          expect(farmsPost2).to.equal(farmsPre - 2)
        })

        it('emits an exitFarmingd event', async () => {
          await expect(subject(lpUser0)).to.emit(context.incentiveFarming, 'FarmEnded').withArgs(
              tokenId,
              incentiveId,
              context.rewardToken.address,
              context.bonusRewardToken.address,
              lpUser0.address,
              BN('9999'),
              BN('199')
          )

          await expect(subjectEternal(lpUser0)).to.emit(context.farming, 'FarmEnded').withArgs(
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
          await snapshotGasCost(subjectEternal(lpUser0))
        })

        it('updates the reward available for the context.tokenomics', async () => {
          const rewardsAccured = await context.incentiveFarming.rewards(context.rewardToken.address, lpUser0.address)
          await subject(lpUser0)
          expect(await context.incentiveFarming.rewards(context.rewardToken.address, lpUser0.address)).to.be.gt(rewardsAccured)

          const rewardsAccured2 = await context.farming.rewards(context.rewardToken.address, lpUser0.address)
          await subjectEternal(lpUser0)
          expect(await context.farming.rewards(context.rewardToken.address, lpUser0.address)).to.be.gt(rewardsAccured2)
        })

        it('updates the farm struct', async () => {
          const farmBefore = await context.farming.farms(tokenId, incentiveIdEternal)
          await subjectEternal(lpUser0)
          const farmAfter = await context.farming.farms(tokenId, incentiveIdEternal)

          expect(farmBefore.liquidity).to.gt(0)
          expect(farmAfter.liquidity).to.eq(0)

          const farmBefore2 = await context.incentiveFarming.farms(tokenId, incentiveId)
          await subject(lpUser0)
          const farmAfter2 = await context.incentiveFarming.farms(tokenId, incentiveId)

          expect(farmBefore2.liquidity).to.gt(0)
          expect(farmAfter2.liquidity).to.eq(0)
        })
    })

      describe('after the end time', () => {
        beforeEach(async () => {
          // Fast-forward to after the end time
          await Time.setAndMine(timestamps.endTime + 100000)
        })

       //  it('anyone cant exitFarming', async () => {
       //    await subject(actors.lpUser1())
       // })

        it('owner can exitFarming', async () => {
          await subject(lpUser0)
          await subjectEternal(lpUser0)
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
        await expect(subjectEternal(lpUser0)).to.revertedWith('ERC721: operator query for nonexistent token')
      })
    })
  })
})
