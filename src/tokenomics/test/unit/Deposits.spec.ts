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
import { contracts } from '@cryptoalgebra/periphery/typechain'

describe('unit/Deposits', () => {
  let actors: ActorFixture
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

  before(async () => {
    const wallets = (await ethers.getSigners()) as any as Wallet[]
    actors = new ActorFixture(wallets, provider)
    lpUser0 = actors.lpUser0()
    incentiveCreator = actors.incentiveCreator()
    recipient = lpUser0.address
  })

  beforeEach('create fixture loader', async () => {
    context = await loadFixture(algebraFixture)
    helpers = HelperCommands.fromTestContext(context, actors, provider)
  })

  let subject: (tokenId: string) => Promise<any>
  let tokenId: string
  const SAFE_TRANSFER_FROM_SIGNATURE = 'safeTransferFrom(address,address,uint256,bytes)'
  const INCENTIVE_KEY_ABI = 'tuple(address rewardToken, address bonusRewardToken, address pool, uint256 startTime, uint256 endTime)'

  beforeEach(async () => {
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
  })

  describe('nft#safeTransferFrom', () => {
    /**
     * We're ultimately checking these variables, so subject calls with calldata (from actor)
     * and returns those three objects. */
    let subject: (calldata: string, actor?: Wallet) => Promise<void>

    let createIncentiveResult: HelperTypes.CreateIncentive.Result

    async function getTokenInfo(_tokenId: string, _createIncentiveResult: HelperTypes.CreateIncentive.Result = createIncentiveResult) {
      const incentiveId = await helpers.getIncentiveId(_createIncentiveResult)
      return {
        deposit: await context.farmingCenter.deposits(_tokenId),
        incentive: await context.eternalFarming.incentives(incentiveId),
        farm: await context.eternalFarming.farms(_tokenId, incentiveId),
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
        bonusReward,
      })

      //await Time.setAndMine(startTime + 1)

      // Make sure we're starting from a clean slate
      const depositBefore = await context.farmingCenter.deposits(tokenId)
      subject = async (data: string, actor: Wallet = lpUser0) => {
        //await context.farmingCenter.connect(lpUser0).lockToken(tokenId)
      }
    })


    xit('allows depositing and staking for a single incentive', async () => {
      const data = ethers.utils.defaultAbiCoder.encode([INCENTIVE_KEY_ABI], [incentiveResultToFarmAdapter(createIncentiveResult)])

      await subject(data, lpUser0)
      const { deposit, incentive, farm } = await getTokenInfo(tokenId)
      expect(deposit).to.not.eq(0x0)
      //expect(farm.secondsPerLiquidityInsideInitialX128).not.to.eq(BN('0'))
    })

    xdescribe('reverts when', () => {
      it('staking info is less than 160 bytes and greater than 0 bytes', async () => {
        const data = ethers.utils.defaultAbiCoder.encode([INCENTIVE_KEY_ABI], [incentiveResultToFarmAdapter(createIncentiveResult)])
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
        const malformedData = ethers.utils.defaultAbiCoder.encode([INCENTIVE_KEY_ABI], [incentiveResultToFarmAdapter(createIncentiveResult)]) + 'aaaa'

        await expect(subject(malformedData)).to.be.reverted
      })
    })
  })

  
})
