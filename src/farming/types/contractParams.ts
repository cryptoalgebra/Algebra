import { BigNumberish } from 'ethers'

export module ContractParams {
  export type Timestamps = {
    startTime: number
    endTime: number
  }

  export type IncentiveKey = {
    pool: string
    rewardToken: string
    bonusRewardToken: string
    nonce: BigNumberish
  } 

  export type CreateIncentive = IncentiveKey & {
    reward: BigNumberish
    bonusReward: BigNumberish
  }

  export type EndIncentive = IncentiveKey
}
