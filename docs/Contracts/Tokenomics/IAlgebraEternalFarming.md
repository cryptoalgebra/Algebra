

# IAlgebraEternalFarming

Algebra Eternal Farming Interface
Allows farming nonfungible liquidity tokens in exchange for reward tokens without locking NFT for incentive time


## Events
### RewardsRatesChanged


`RewardsRatesChanged(uint128,uint128,bytes32)`  

Event emitted when reward rates were changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardRate | uint128 | The new rate of main token distribution per sec |
| bonusRewardRate | uint128 | The new rate of bonus token distribution per sec |
| incentiveId | bytes32 | The ID of the incentive for which rates were changed |


### RewardsCollected


`RewardsCollected(uint256,bytes32,uint256,uint256)`  

Event emitted when rewards were added



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token for which rewards were collected |
| incentiveId | bytes32 | The ID of the incentive for which rewards were collected |
| rewardAmount | uint256 | Collected amount of reward |
| bonusRewardAmount | uint256 | Collected amount of bonus reward |


### EternalFarmingCreated


`EternalFarmingCreated(contract IERC20Minimal,contract IERC20Minimal,contract IAlgebraPool,address,uint256,uint256,uint256,uint256,struct IAlgebraFarming.Tiers,address)`  

Event emitted when a liquidity mining incentive has been created



| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardToken | contract IERC20Minimal | The token being distributed as a reward |
| bonusRewardToken | contract IERC20Minimal | The token being distributed as a bonus reward |
| pool | contract IAlgebraPool | The Algebra pool |
| virtualPool | address | The virtual pool address |
| startTime | uint256 | The time when the incentive program begins |
| endTime | uint256 | The time when rewards stop accruing |
| reward | uint256 | The amount of reward tokens to be distributed |
| bonusReward | uint256 | The amount of bonus reward tokens to be distributed |
| tiers | struct IAlgebraFarming.Tiers | The amounts of locked token for liquidity multipliers |
| multiplierToken | address | The address of token which can be locked to get liquidity multiplier |




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

### createEternalFarming


`createEternalFarming(struct IIncentiveKey.IncentiveKey,uint256,uint256,uint128,uint128,address,struct IAlgebraFarming.Tiers)`  external

Creates a new liquidity mining incentive program



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | Details of the incentive to create |
| reward | uint256 | The amount of reward tokens to be distributed |
| bonusReward | uint256 | The amount of bonus reward tokens to be distributed |
| rewardRate | uint128 | The rate of reward distribution per second |
| bonusRewardRate | uint128 | The rate of bonus reward distribution per second |
| multiplierToken | address | The address of token which can be locked to get liquidity multiplier |
| tiers | struct IAlgebraFarming.Tiers | The amounts of locked token for liquidity multipliers |

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


