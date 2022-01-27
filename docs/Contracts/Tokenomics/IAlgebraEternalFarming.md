

# IAlgebraEternalFarming


## Events
### RewardsRatesChanged


`RewardsRatesChanged(uint128,uint128,bytes32)`  

Event emitted when reward rates were changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardRate | uint128 | The new rate of main token distribution per sec |
| bonusRewardRate | uint128 | The new rate of bonus token distribution per sec |
| incentiveId | bytes32 | The ID of the incentive for which rates were changed |


### RewardsAdded


`RewardsAdded(uint256,uint256,bytes32)`  

Event emitted when rewards were added



| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardAmount | uint256 | The additional amount of main token |
| bonusRewardAmount | uint256 | The additional amount of bonus token |
| incentiveId | bytes32 | The ID of the incentive for which rewards were added |




## Functions
### farms


`farms(uint256,bytes32)` view external

Returns information about a farmd liquidity NFT



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the farmd token |
| incentiveId | bytes32 | The ID of the incentive for which the token is farmd |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidity | uint128 |  |
| tickLower | int24 |  |
| tickUpper | int24 |  |
| innerRewardGrowth0 | uint256 |  |
| innerRewardGrowth1 | uint256 |  |

### createIncentive


`createIncentive(struct IIncentiveKey.IncentiveKey,uint256,uint256,uint128,uint128)`  external

Creates a new liquidity mining incentive program



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | Details of the incentive to create |
| reward | uint256 | The amount of reward tokens to be distributed |
| bonusReward | uint256 | The amount of bonus reward tokens to be distributed |
| rewardRate | uint128 |  |
| bonusRewardRate | uint128 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPool | address |  |

### addRewards


`addRewards(struct IIncentiveKey.IncentiveKey,uint256,uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey |  |
| rewardAmount | uint256 |  |
| bonusRewardAmount | uint256 |  |


### setRates


`setRates(struct IIncentiveKey.IncentiveKey,uint128,uint128)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey |  |
| rewardRate | uint128 |  |
| bonusRewardRate | uint128 |  |


### collectRewards


`collectRewards(struct IIncentiveKey.IncentiveKey,uint256,address)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey |  |
| tokenId | uint256 |  |
| _owner | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 |  |
| bonusReward | uint256 |  |



---


