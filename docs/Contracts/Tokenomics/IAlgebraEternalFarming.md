

# IAlgebraEternalFarming


Algebra Eternal Farming Interface

Allows farming nonfungible liquidity tokens in exchange for reward tokens without locking NFT for incentive time



## Events
### RewardsRatesChanged


`event RewardsRatesChanged(uint128 rewardRate, uint128 bonusRewardRate, bytes32 incentiveId)`  

Event emitted when reward rates were changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardRate | uint128 | The new rate of main token distribution per sec |
| bonusRewardRate | uint128 | The new rate of bonus token distribution per sec |
| incentiveId | bytes32 | The ID of the incentive for which rates were changed |


### RewardsCollected


`event RewardsCollected(uint256 tokenId, bytes32 incentiveId, uint256 rewardAmount, uint256 bonusRewardAmount)`  

Event emitted when rewards were added



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token for which rewards were collected |
| incentiveId | bytes32 | The ID of the incentive for which rewards were collected |
| rewardAmount | uint256 | Collected amount of reward |
| bonusRewardAmount | uint256 | Collected amount of bonus reward |


### EternalFarmingCreated


`event EternalFarmingCreated(contract IERC20Minimal rewardToken, contract IERC20Minimal bonusRewardToken, contract IAlgebraPool pool, address virtualPool, uint256 startTime, uint256 endTime, uint256 reward, uint256 bonusReward, struct IAlgebraFarming.Tiers tiers, address multiplierToken, uint24 minimalAllowedPositionWidth)`  

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
| minimalAllowedPositionWidth | uint24 | The minimal allowed position width (tickUpper - tickLower) |




## Functions
### farms


`function farms(uint256 tokenId, bytes32 incentiveId) external view returns (uint128 liquidity, int24 tickLower, int24 tickUpper, uint256 innerRewardGrowth0, uint256 innerRewardGrowth1)` view external

Returns information about a farmd liquidity NFT



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the farmd token |
| incentiveId | bytes32 | The ID of the incentive for which the token is farmd |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidity | uint128 | The amount of liquidity in the NFT as of the last time the rewards were computed, tickLower The lower tick of position, tickUpper The upper tick of position, innerRewardGrowth0 The last saved reward0 growth inside position, innerRewardGrowth1 The last saved reward1 growth inside position |
| tickLower | int24 |  |
| tickUpper | int24 |  |
| innerRewardGrowth0 | uint256 |  |
| innerRewardGrowth1 | uint256 |  |

### createEternalFarming


`function createEternalFarming(struct IIncentiveKey.IncentiveKey key, struct IAlgebraEternalFarming.IncentiveParams params, struct IAlgebraFarming.Tiers tiers) external returns (address virtualPool)`  external

Creates a new liquidity mining incentive program



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | Details of the incentive to create |
| params | struct IAlgebraEternalFarming.IncentiveParams | Params of incentive |
| tiers | struct IAlgebraFarming.Tiers | The amounts of locked token for liquidity multipliers |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPool | address | The virtual pool |

### setRates


`function setRates(struct IIncentiveKey.IncentiveKey key, uint128 rewardRate, uint128 bonusRewardRate) external`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey |  |
| rewardRate | uint128 |  |
| bonusRewardRate | uint128 |  |


### collectRewards


`function collectRewards(struct IIncentiveKey.IncentiveKey key, uint256 tokenId, address _owner) external returns (uint256 reward, uint256 bonusReward)`  external





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




