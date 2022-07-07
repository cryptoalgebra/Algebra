

# IAlgebraIncentiveFarming

Algebra Farming Interface
Allows farming nonfungible liquidity tokens in exchange for reward tokens


## Events
### IncentiveCreated


`IncentiveCreated(contract IERC20Minimal,contract IERC20Minimal,contract IAlgebraPool,uint256,uint256,uint256,uint256,struct IAlgebraFarming.Tiers,address,uint32)`  

Event emitted when a liquidity mining incentive has been created



| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardToken | contract IERC20Minimal | The token being distributed as a reward |
| bonusRewardToken | contract IERC20Minimal | The token being distributed as a bonus reward |
| pool | contract IAlgebraPool | The Algebra pool |
| startTime | uint256 | The time when the incentive program begins |
| endTime | uint256 | The time when rewards stop accruing |
| reward | uint256 | The amount of reward tokens to be distributed |
| bonusReward | uint256 | The amount of bonus reward tokens to be distributed |
| tiers | struct IAlgebraFarming.Tiers | The amounts of locked token for liquidity multipliers |
| multiplierToken | address | The address of token which can be locked to get liquidity multiplier |
| enterStartTime | uint32 | The time when enter becomes possible |


### RewardAmountsDecreased


`RewardAmountsDecreased(uint256,uint256,bytes32)`  





| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 |  |
| bonusReward | uint256 |  |
| incentiveId | bytes32 |  |




## Functions
### maxIncentiveDuration


`maxIncentiveDuration()` view external

The max duration of an incentive in seconds




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### maxIncentiveStartLeadTime


`maxIncentiveStartLeadTime()` view external

The max amount of seconds into the future the incentive startTime can be set




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

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

### createIncentive


`createIncentive(struct IIncentiveKey.IncentiveKey,struct IAlgebraFarming.Tiers,struct IAlgebraIncentiveFarming.IncentiveParams)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey |  |
| tiers | struct IAlgebraFarming.Tiers |  |
| params | struct IAlgebraIncentiveFarming.IncentiveParams |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPool | address |  |

### decreaseRewardsAmount


`decreaseRewardsAmount(struct IIncentiveKey.IncentiveKey,uint256,uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey |  |
| rewards | uint256 |  |
| bonusRewards | uint256 |  |




---


