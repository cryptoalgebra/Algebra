

# IAlgebraLimitFarming


Algebra Farming Interface

Allows farming nonfungible liquidity tokens in exchange for reward tokens



## Events
### LimitFarmingCreated


`event LimitFarmingCreated(contract IERC20Minimal rewardToken, contract IERC20Minimal bonusRewardToken, contract IAlgebraPool pool, uint256 startTime, uint256 endTime, uint256 reward, uint256 bonusReward, struct IAlgebraFarming.Tiers tiers, address multiplierToken, uint24 minimalAllowedPositionWidth, uint32 enterStartTime)`  

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
| minimalAllowedPositionWidth | uint24 | The minimal allowed position width (tickUpper - tickLower) |
| enterStartTime | uint32 | The time when enter becomes possible |


### RewardAmountsDecreased


`event RewardAmountsDecreased(uint256 reward, uint256 bonusReward, bytes32 incentiveId)`  





| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 |  |
| bonusReward | uint256 |  |
| incentiveId | bytes32 |  |




## Functions
### maxIncentiveDuration


`function maxIncentiveDuration() external view returns (uint256)` view external

The max duration of an incentive in seconds




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### maxIncentiveStartLeadTime


`function maxIncentiveStartLeadTime() external view returns (uint256)` view external

The max amount of seconds into the future the incentive startTime can be set




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### farms


`function farms(uint256 tokenId, bytes32 incentiveId) external view returns (uint128 liquidity, int24 tickLower, int24 tickUpper)` view external

Returns information about a farmd liquidity NFT



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the farmd token |
| incentiveId | bytes32 | The ID of the incentive for which the token is farmd |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidity | uint128 | The amount of liquidity in the NFT as of the last time the rewards were computed, tickLower The lower end of the tick range for the position, tickUpper The upper end of the tick range for the position |
| tickLower | int24 |  |
| tickUpper | int24 |  |

### createLimitFarming


`function createLimitFarming(struct IIncentiveKey.IncentiveKey key, struct IAlgebraFarming.Tiers tiers, struct IAlgebraLimitFarming.IncentiveParams params) external returns (address virtualPool)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey |  |
| tiers | struct IAlgebraFarming.Tiers |  |
| params | struct IAlgebraLimitFarming.IncentiveParams |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPool | address |  |

### addRewards


`function addRewards(struct IIncentiveKey.IncentiveKey key, uint256 reward, uint256 bonusReward) external`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey |  |
| reward | uint256 |  |
| bonusReward | uint256 |  |


### decreaseRewardsAmount


`function decreaseRewardsAmount(struct IIncentiveKey.IncentiveKey key, uint256 rewardAmount, uint256 bonusRewardAmount) external`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey |  |
| rewardAmount | uint256 |  |
| bonusRewardAmount | uint256 |  |





