import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'
import { TestRewardMath } from '../../../typechain'
import { expect } from '../../shared'

describe('unit/RewardMath', () => {
  let rewardMath: TestRewardMath

  before('setup test reward math', async () => {
    const factory = await ethers.getContractFactory('TestRewardMath')
    rewardMath = (await factory.deploy()) as TestRewardMath
  })

  it('half the liquidity over 20% of the total duration', async () => {
    const reward = await rewardMath.computeRewardAmount(
      /**totalRewardUnclaimed=*/ 1000,
      /**startTime=*/ 100,
      /**endTime=*/ 200,
      /**liquidity=*/ 5,
      /**totalLiq=*/ 0,
      /**innerSecondsSpentPerLiquidity=*/ BigNumber.from(20).shl(128).div(10)
    )
    // 1000 * 0.5 * 0.2
    expect(reward).to.eq(100)
  })

  it('all the liquidity for the duration and none of the liquidity after the end time for a whole duration', async () => {
    const reward = await rewardMath.computeRewardAmount(
      /**totalRewardUnclaimed=*/ 1000,
      /**startTime=*/ 100,
      /**endTime=*/ 200,
      /**liquidity=*/ 100,
      /**totalLiq=*/ 0,
      /**innerSecondsSpentPerLiquidity=*/ BigNumber.from(100).shl(128).div(100)
    )
    // half the reward goes to the tokenomics, the other half goes to those staking after the period
    expect(reward).to.eq(1000)
  })

  it('all the liquidity for the duration and none of the liquidity after the end time for one second', async () => {
    const reward = await rewardMath.computeRewardAmount(
      /**totalRewardUnclaimed=*/ 1000,
      /**startTime=*/ 100,
      /**endTime=*/ 200,
      /**liquidity=*/ 100,
      /**totalLiq=*/ 0,
      /**innerSecondsSpentPerLiquidity=*/ BigNumber.from(100).shl(128).div(100)
    )
    // the reward decays by up to the reward rate per second
    expect(reward).to.eq(1000)
  })

  it('if some time is already claimed the reward is greater', async () => {
    const reward = await rewardMath.computeRewardAmount(
      /**totalRewardUnclaimed=*/ 1000,
      /**startTime=*/ 100,
      /**endTime=*/ 200,
      /**liquidity=*/ 5,
      /**totalLiq=*/ 0,
      /**innerSecondsSpentPerLiquidity=*/ BigNumber.from(20).shl(128).div(10)
    )
    expect(reward).to.eq(100)
  })

  it('0 rewards left gets 0 reward', async () => {
    const reward = await rewardMath.computeRewardAmount(
      /**totalRewardUnclaimed=*/ 0,
      /**startTime=*/ 100,
      /**endTime=*/ 200,
      /**liquidity=*/ 5,
      /**totalLiq=*/ 0,
      /**innerSecondsSpentPerLiquidity=*/ BigNumber.from(20).shl(128).div(10)
    )
    expect(reward).to.eq(0)
  })

  it('0 difference in seconds inside gets 0 reward', async () => {
    const reward = await rewardMath.computeRewardAmount(
      /**totalRewardUnclaimed=*/ 1000,
      /**startTime=*/ 100,
      /**endTime=*/ 200,
      /**liquidity=*/ 5,
      /**totalLiq=*/ 0,
      /**innerSecondsSpentPerLiquidity=*/ BigNumber.from(20).shl(128).div(10)
    )
    expect(reward).to.eq(100)
  })

  it('0 liquidity gets 0 reward', async () => {
    const reward = await rewardMath.computeRewardAmount(
      /**totalRewardUnclaimed=*/ 1000,
      /**startTime=*/ 100,
      /**endTime=*/ 200,
      /**liquidity=*/ 0,
      /**totalLiq=*/ 0,
      /**innerSecondsSpentPerLiquidity=*/ BigNumber.from(20).shl(128).div(10)
    )
    expect(reward).to.eq(0)
  })
})
