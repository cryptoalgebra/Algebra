import { constants, BigNumberish, Wallet } from 'ethers'
import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { algebraFixture, mintPosition, AlgebraFixtureType } from '../shared/fixtures'
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
} from '../shared'
import { provider } from '../shared/provider'
import { HelperCommands, ERC20Helper, incentiveResultToFarmAdapter } from '../helpers'

import { ContractParams } from '../../types/contractParams'
import { createTimeMachine } from '../shared/time'
import { HelperTypes } from '../helpers/types'

const LIMIT_FARMING = true;
const ETERNAL_FARMING = false;

describe('unit/Deposits', () => {
  let actors: ActorFixture;
  let lpUser0: Wallet
  const amountDesired = BNe18(10)
  const totalReward = BNe18(100)
  const bonusReward = BNe18(100)
  const erc20Helper = new ERC20Helper()
  const Time = createTimeMachine(provider)
  let helpers: HelperCommands
  let incentiveCreator: Wallet
  let context: AlgebraFixtureType
  let recipient: string

  before(async() => {
    const wallets = (await ethers.getSigners() as any) as Wallet[];
    actors = new ActorFixture(wallets, provider)
    lpUser0 = actors.lpUser0();
    incentiveCreator = actors.incentiveCreator();
    recipient = lpUser0.address
  })

  beforeEach('create fixture loader', async () => {
    context = await loadFixture(algebraFixture)
    helpers = HelperCommands.fromTestContext(context, actors, provider)
  })

  let subject: (tokenId: string, recipient: string) => Promise<any>
  let tokenId: string
  const SAFE_TRANSFER_FROM_SIGNATURE = 'safeTransferFrom(address,address,uint256,bytes)'
  const INCENTIVE_KEY_ABI =
    'tuple(address rewardToken, address bonusRewardToken, address pool, uint256 startTime, uint256 endTime)'

  beforeEach(async () => {
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

  })

  describe('nft#safeTransferFrom', () => {
    /**
     * We're ultimately checking these variables, so subject calls with calldata (from actor)
     * and returns those three objects. */
    let subject: (calldata: string, actor?: Wallet) => Promise<void>

    let createIncentiveResult: HelperTypes.CreateIncentive.Result

    async function getTokenInfo(
      tokenId: string,
      _createIncentiveResult: HelperTypes.CreateIncentive.Result = createIncentiveResult
    ) {
      const incentiveId = await helpers.getIncentiveId(_createIncentiveResult)
      return {
        deposit: await context.farmingCenter.deposits(tokenId),
        incentive: await context.farming.incentives(incentiveId),
        farm: await context.farming.farms(tokenId, incentiveId),
      }
    }

    beforeEach('setup', async () => {
      const { startTime } = makeTimestamps(await blockTimestamp())
      createIncentiveResult = await helpers.createIncentiveFlow({
        rewardToken: context.rewardToken,
        bonusRewardToken: context.bonusRewardToken,
        poolAddress: context.poolObj.address,
        startTime,
        totalReward,
        bonusReward
      })

      //await Time.setAndMine(startTime + 1)

      // Make sure we're starting from a clean slate
      const depositBefore = await context.farmingCenter.deposits(tokenId)
      expect(depositBefore.L2TokenId).to.eq((await context.farmingCenter.l2Nfts(depositBefore.L2TokenId)).tokenId)
      subject = async (data: string, actor: Wallet = lpUser0) => {
        await context.nft
          .connect(actor)
          [SAFE_TRANSFER_FROM_SIGNATURE](actor.address, context.farmingCenter.address, tokenId, data, {
            ...maxGas,
            from: actor.address,
          })
      }
    })

    it('allows depositing without staking', async () => {
      // Pass empty data
      await subject(ethers.utils.defaultAbiCoder.encode([], []))
      const { deposit, incentive, farm } = await getTokenInfo(tokenId)
      expect(deposit.L2TokenId).to.eq(BN('1'))
      expect(deposit.numberOfFarms).to.eq(BN('0'))
      //expect(farm.secondsPerLiquidityInsideInitialX128).to.eq(BN('0'))
    })

    xit('allows depositing and staking for a single incentive', async () => {      
      const data = ethers.utils.defaultAbiCoder.encode(
        [INCENTIVE_KEY_ABI],
        [incentiveResultToFarmAdapter(createIncentiveResult)]
      )

      await subject(data, lpUser0)
      const { deposit, incentive, farm } = await getTokenInfo(tokenId)
      expect(deposit.L2TokenId).to.eq(BN('1'))
      expect(deposit.numberOfFarms).to.eq(BN('1'))
      //expect(farm.secondsPerLiquidityInsideInitialX128).not.to.eq(BN('0'))
    })

    xdescribe('reverts when', () => {
      it('staking info is less than 160 bytes and greater than 0 bytes', async () => {
        const data = ethers.utils.defaultAbiCoder.encode(
          [INCENTIVE_KEY_ABI],
          [incentiveResultToFarmAdapter(createIncentiveResult)]
        )
        const malformedData = data.slice(0, data.length - 2)
        await expect(subject(malformedData)).to.be.reverted
      })

      it('it has an invalid pool address', async () => {
        const data = ethers.utils.defaultAbiCoder.encode(
          [INCENTIVE_KEY_ABI],
          [
            // Make the data invalid
            incentiveResultToFarmAdapter({
              ...createIncentiveResult,
              poolAddress: constants.AddressZero,
            }),
          ]
        )

        await expect(subject(data)).to.be.reverted
      })

      it('staking information is invalid and greater than 160 bytes', async () => {
        const malformedData =
          ethers.utils.defaultAbiCoder.encode(
            [INCENTIVE_KEY_ABI],
            [incentiveResultToFarmAdapter(createIncentiveResult)]
          ) + 'aaaa'

        await expect(subject(malformedData)).to.be.reverted
      })
    })
  })

  describe('#onERC721Received', () => {
    const incentiveKeyAbi =
      'tuple(address rewardToken, address bonusRewardToken, address pool, uint256 startTime, uint256 endTime)'
    let tokenId: BigNumberish
    let data: string
    let timestamps: ContractParams.Timestamps

    beforeEach('set up position', async () => {
      const { rewardToken } = context
      const { bonusRewardToken} = context
      timestamps = makeTimestamps((await blockTimestamp()) + 1_000)

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

      const incentive = await helpers.createIncentiveFlow({
        rewardToken,
        bonusRewardToken,
        totalReward,
        bonusReward,
        poolAddress: context.poolObj.address,
        ...timestamps,
      })

      const incentiveKey: ContractParams.IncentiveKey = incentiveResultToFarmAdapter(incentive)

      data = ethers.utils.defaultAbiCoder.encode([incentiveKeyAbi], [incentiveKey])
    })

    describe('on successful transfer with staking data', () => {
      // beforeEach('set the timestamp after the start time', async () => {
      //   await Time.set(timestamps.startTime + 1)
      // })

      it('deposits the token', async () => {
        expect((await context.farmingCenter.deposits(tokenId)).L2TokenId).to.equal(0)
        await context.nft
          .connect(lpUser0)
          ['safeTransferFrom(address,address,uint256)'](lpUser0.address, context.farmingCenter.address, tokenId, {
            ...maxGas,
            from: lpUser0.address,
          })

        expect((await context.farmingCenter.deposits(tokenId)).L2TokenId).to.equal(1)
      })

      it('properly farms the deposit in the select incentive', async () => {
        const incentiveId = await context.testIncentiveId.compute({
          rewardToken: context.rewardToken.address,
          bonusRewardToken: context.bonusRewardToken.address,
          pool: context.pool01,
          startTime: timestamps.startTime,
          endTime: timestamps.endTime,
          
        })
        //await Time.set(timestamps.startTime + 10)
        const farmBefore = await context.farming.farms(tokenId, incentiveId)
        const depositBefore = await context.farmingCenter.deposits(tokenId)

        await context.nft
          .connect(lpUser0)
          ['safeTransferFrom(address,address,uint256,bytes)'](lpUser0.address, context.farmingCenter.address, tokenId, data, {
            ...maxGas,
            from: lpUser0.address,
          })

        const farmAfter = await context.farming.farms(tokenId, incentiveId)

        expect(depositBefore.L2TokenId).to.equal(0)
        expect((await context.farmingCenter.deposits(tokenId)).L2TokenId).to.equal(1)
        //expect(farmBefore.secondsPerLiquidityInsideInitialX128).to.equal(0)
        //expect(farmAfter.secondsPerLiquidityInsideInitialX128).to.be.gt(0)
      })

      xit('has gas cost [ @skip-on-coverage ]', async () => {
        await snapshotGasCost(
          context.nft
            .connect(lpUser0)
            ['safeTransferFrom(address,address,uint256,bytes)'](
              lpUser0.address,
              context.farmingCenter.address,
              tokenId,
              data,
              {
                ...maxGas,
                from: lpUser0.address,
              }
            )
        )
      })
    })

    xdescribe('on invalid call', async () => {
      it('reverts when called by contract other than Algebra nonfungiblePositionManager', async () => {
        await expect(
          context.farmingCenter.connect(lpUser0).onERC721Received(incentiveCreator.address, lpUser0.address, 1, data)
        ).to.be.revertedWith('not an Algebra nft')
      })

      it('reverts when staking on invalid incentive', async () => {
        const invalidFarmParams = {
          rewardToken: context.rewardToken.address,
          bonusRewardToken: context.bonusRewardToken.address,
          
          pool: context.rewardToken.address,
          ...timestamps
        }

        let invalidData = ethers.utils.defaultAbiCoder.encode([incentiveKeyAbi], [invalidFarmParams])

        await expect(
          context.nft
            .connect(lpUser0)
            ['safeTransferFrom(address,address,uint256,bytes)'](
              lpUser0.address,
              context.farmingCenter.address,
              tokenId,
              invalidData
            )
        ).to.be.revertedWith('non-existent incentive')
      })
    })
  })

  describe('#withdrawToken', () => {
    beforeEach(async () => {
      await context.nft
        .connect(lpUser0)
        ['safeTransferFrom(address,address,uint256)'](lpUser0.address, context.farmingCenter.address, tokenId)

      subject = (L2TokenId, _recipient) => context.farmingCenter.connect(lpUser0).withdrawToken(L2TokenId, _recipient, '0x')
    })

    describe('works and', () => {
      it('emits a DepositTransferred event', async () =>
        await expect(subject(tokenId, recipient))
          .to.emit(context.farmingCenter, 'DepositTransferred')
          .withArgs(tokenId, recipient, constants.AddressZero))

      it('transfers nft ownership', async () => {
        await subject(tokenId, recipient)
        expect(await context.nft.ownerOf(tokenId)).to.eq(recipient)
      })

      it('prevents you from withdrawing twice', async () => {
        await subject(tokenId, recipient)
        expect(await context.nft.ownerOf(tokenId)).to.eq(recipient)
        await expect(subject(tokenId, recipient)).to.be.reverted
      })

      it('deletes deposit upon withdrawal', async () => {
        expect((await context.farmingCenter.deposits(tokenId)).L2TokenId).to.equal(1)
        await subject(tokenId, recipient)
        expect((await context.farmingCenter.deposits(tokenId)).L2TokenId).to.equal(0)
      })

      xit('has gas cost [ @skip-on-coverage ]', async () => await snapshotGasCost(subject(tokenId, recipient)))
    })

    describe('fails if', () => {
      it('you are withdrawing a token that is not yours', async () => {
        const notOwner = actors.traderUser1()
        await expect(context.farmingCenter.connect(notOwner).withdrawToken(tokenId, notOwner.address, '0x')).to.revertedWith(
          'Not approved'
        )
      })

      it('you are withdrawing a token to farming center', async () => {
        
        await expect(context.farmingCenter.connect(lpUser0).withdrawToken(tokenId, context.farmingCenter.address, '0x')).to.revertedWith(
          'cannot withdraw to farming'
        )
      })

      it('number of farms is not 0', async () => {
        const timestamps = makeTimestamps(await blockTimestamp())
        const incentiveParams: HelperTypes.CreateIncentive.Args = {
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          totalReward,
          bonusReward,
          poolAddress: context.poolObj.address,
          ...timestamps,
        }
        const incentive = await helpers.createIncentiveFlow(incentiveParams)
        //await Time.setAndMine(timestamps.startTime + 1)
        await context.farmingCenter.connect(lpUser0).enterFarming(
          {
            ...incentive,
            pool: context.pool01,
            rewardToken: incentive.rewardToken.address,
            bonusRewardToken: incentive.bonusRewardToken.address,
          },
          tokenId,
          0,
          LIMIT_FARMING
        )

        await expect(subject(tokenId, lpUser0.address)).to.revertedWith(
          'cannot withdraw token while farmd'
        )
      })
    })
  })

  describe('#transferNFTL2',  () => {

    let lpUser1: Wallet     

    beforeEach('setup', async () => {
        lpUser1 = actors.lpUser1()   

        await context.nft.connect(lpUser0).approve(lpUser1.address,tokenId)
  
        await context.nft.connect(lpUser0)['safeTransferFrom(address,address,uint256)'](lpUser0.address, context.farmingCenter.address, tokenId,{...maxGas,from: lpUser0.address,})      


      })

    it('emits a Transfer event', async () =>{
      
      const timestamps = makeTimestamps(await blockTimestamp())
        
      const incentiveParams: HelperTypes.CreateIncentive.Args = {
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          totalReward,
          bonusReward,
          poolAddress: context.poolObj.address,
          ...timestamps,
          ...maxGas,
        }


      const incentive = await helpers.createIncentiveFlow(incentiveParams)
        //await Time.setAndMine(timestamps.startTime + 1)
      await context.farmingCenter.connect(lpUser0).enterFarming(
          {
            ...incentive,
            pool: context.pool01,
            rewardToken: incentive.rewardToken.address,
            bonusRewardToken: incentive.bonusRewardToken.address,
          },
          tokenId,
          0,
          LIMIT_FARMING
      )   
      const { owner: ownerBefore, L2TokenId: l2TokenId} = await context.farmingCenter.deposits(tokenId)
      await context.farmingCenter.connect(lpUser0).approve(lpUser1.address, l2TokenId)
      await expect(context.farmingCenter.connect(lpUser0)['safeTransferFrom(address,address,uint256)'](lpUser0.address, lpUser1.address, l2TokenId))
        .to.emit(context.farmingCenter, 'Transfer')
        .withArgs(lpUser0.address, lpUser1.address, tokenId)
    })

    it('transfers nft ownership', async () => {
      const timestamps = makeTimestamps(await blockTimestamp())
        
      const incentiveParams: HelperTypes.CreateIncentive.Args = {
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          totalReward,
          bonusReward,
          poolAddress: context.poolObj.address,
          ...timestamps,
          ...maxGas,
        }


      const incentive = await helpers.createIncentiveFlow(incentiveParams)
        //await Time.setAndMine(timestamps.startTime + 1)
      await context.farmingCenter.connect(lpUser0).enterFarming(
          {
            ...incentive,
            pool: context.pool01,
            rewardToken: incentive.rewardToken.address,
            bonusRewardToken: incentive.bonusRewardToken.address,
          },
          tokenId,
          0,
          LIMIT_FARMING
      )   
      const { owner: ownerBefore, L2TokenId: l2TokenId} = await context.farmingCenter.deposits(tokenId)
      await context.farmingCenter.connect(lpUser0).approve(lpUser1.address, l2TokenId)
      await context.farmingCenter.connect(lpUser0)['safeTransferFrom(address,address,uint256)'](lpUser0.address, lpUser1.address, l2TokenId)
      await context.farmingCenter.connect(lpUser1).exitFarming(
          {
            ...incentive,
            pool: context.pool01,
            rewardToken: incentive.rewardToken.address,
            bonusRewardToken: incentive.bonusRewardToken.address,
          },
          tokenId,
          LIMIT_FARMING
        )
      const { owner: ownerAfter } = await context.farmingCenter.deposits(tokenId)
      expect(ownerBefore).to.eq(lpUser0.address)
      expect(ownerAfter).to.eq(lpUser1.address)

    })

    it('can only be called by the owner', async () => {
      const timestamps = makeTimestamps(await blockTimestamp())
        
      const incentiveParams: HelperTypes.CreateIncentive.Args = {
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          totalReward,
          bonusReward,
          poolAddress: context.poolObj.address,
          ...timestamps,
          ...maxGas,
        }


      const incentive = await helpers.createIncentiveFlow(incentiveParams)
        //await Time.setAndMine(timestamps.startTime + 1)
      await context.farmingCenter.connect(lpUser0).enterFarming(
          {
            ...incentive,
            pool: context.pool01,
            rewardToken: incentive.rewardToken.address,
            bonusRewardToken: incentive.bonusRewardToken.address,
          },
          tokenId,
          0,
          LIMIT_FARMING
      )   
      const { owner: ownerBefore, L2TokenId: l2TokenId} = await context.farmingCenter.deposits(tokenId)
      await context.farmingCenter.connect(lpUser0).approve(lpUser1.address, l2TokenId)
      await expect(context.farmingCenter.connect(lpUser0)['safeTransferFrom(address,address,uint256)'](lpUser1.address, lpUser0.address, l2TokenId)).to.be.revertedWith(
        'ERC721: transfer of token that is not own')
    })

    it('cannot be transferred to address 0', async () => {
            const timestamps = makeTimestamps(await blockTimestamp())
        
      const incentiveParams: HelperTypes.CreateIncentive.Args = {
          rewardToken: context.rewardToken,
          bonusRewardToken: context.bonusRewardToken,
          totalReward,
          bonusReward,
          poolAddress: context.poolObj.address,
          ...timestamps,
          ...maxGas,
        }


      const incentive = await helpers.createIncentiveFlow(incentiveParams)
        //await Time.setAndMine(timestamps.startTime + 1)
      await context.farmingCenter.connect(lpUser0).enterFarming(
          {
            ...incentive,
            pool: context.pool01,
            rewardToken: incentive.rewardToken.address,
            bonusRewardToken: incentive.bonusRewardToken.address,
          },
          tokenId,
          0,
          LIMIT_FARMING
      )   
      const { owner: ownerBefore, L2TokenId: l2TokenId} = await context.farmingCenter.deposits(tokenId)
      await context.farmingCenter.connect(lpUser0).approve(lpUser1.address, l2TokenId)
      await expect(context.farmingCenter.connect(lpUser0)['safeTransferFrom(address,address,uint256)'](lpUser1.address, constants.AddressZero, l2TokenId)).to.be.revertedWith(
        'ERC721: transfer of token that is not own')
    })

    //it('has gas cost', () => snapshotGasCost(context.farming.connect(lpUser0).safeTransferFrom(lpUser0.address, lpUser1.address,tokenId)))
  })
})