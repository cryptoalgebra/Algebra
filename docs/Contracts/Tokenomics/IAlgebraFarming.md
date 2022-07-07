

# IAlgebraFarming

Algebra Farming Interface
Allows farming nonfungible liquidity tokens in exchange for reward tokens


## Events
### IncentiveDetached


`IncentiveDetached(contract IERC20Minimal,contract IERC20Minimal,contract IAlgebraPool,address,uint256,uint256)`  

Event emitted when a liquidity mining incentive has been stopped from the outside



| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardToken | contract IERC20Minimal | The token being distributed as a reward |
| bonusRewardToken | contract IERC20Minimal | The token being distributed as a bonus reward |
| pool | contract IAlgebraPool | The Algebra pool |
| virtualPool | address | The detached virtual pool address |
| startTime | uint256 | The time when the incentive program begins |
| endTime | uint256 | The time when rewards stop accruing |


### IncentiveAttached


`IncentiveAttached(contract IERC20Minimal,contract IERC20Minimal,contract IAlgebraPool,address,uint256,uint256)`  

Event emitted when a liquidity mining incentive has been runned again from the outside



| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardToken | contract IERC20Minimal | The token being distributed as a reward |
| bonusRewardToken | contract IERC20Minimal | The token being distributed as a bonus reward |
| pool | contract IAlgebraPool | The Algebra pool |
| virtualPool | address | The attached virtual pool address |
| startTime | uint256 | The time when the incentive program begins |
| endTime | uint256 | The time when rewards stop accruing |


### FarmEntered


`FarmEntered(uint256,bytes32,uint128,uint256)`  

Event emitted when a Algebra LP token has been farmd



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The unique identifier of an Algebra LP token |
| incentiveId | bytes32 | The incentive in which the token is farming |
| liquidity | uint128 | The amount of liquidity farmd |
| tokensLocked | uint256 | The amount of tokens locked for multiplier |


### FarmEnded


`FarmEnded(uint256,bytes32,address,address,address,uint256,uint256)`  

Event emitted when a Algebra LP token has been exitFarmingd



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The unique identifier of an Algebra LP token |
| incentiveId | bytes32 | The incentive in which the token is farming |
| rewardAddress | address | The token being distributed as a reward |
| bonusRewardToken | address | The token being distributed as a bonus reward |
| owner | address | The address where claimed rewards were sent to |
| reward | uint256 | The amount of reward tokens to be distributed |
| bonusReward | uint256 | The amount of bonus reward tokens to be distributed |


### IncentiveMaker


`IncentiveMaker(address)`  

Emitted when the incentive maker is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| incentiveMaker | address | The incentive maker after the address was changed |


### FarmingCenter


`FarmingCenter(address)`  

Emitted when the farming center is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| farmingCenter | address | The farming center after the address was changed |


### RewardsAdded


`RewardsAdded(uint256,uint256,bytes32)`  

Event emitted when rewards were added



| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardAmount | uint256 | The additional amount of main token |
| bonusRewardAmount | uint256 | The additional amount of bonus token |
| incentiveId | bytes32 | The ID of the incentive for which rewards were added |


### RewardClaimed


`RewardClaimed(address,uint256,address,address)`  

Event emitted when a reward token has been claimed



| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address | The address where claimed rewards were sent to |
| reward | uint256 | The amount of reward tokens claimed |
| rewardAddress | address | The token reward address |
| owner | address | The address where claimed rewards were sent to |




## Functions
### nonfungiblePositionManager


`nonfungiblePositionManager()` view external

The nonfungible position manager with which this farming contract is compatible




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract INonfungiblePositionManager |  |

### farmingCenter


`farmingCenter()` view external

The farming Center




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IFarmingCenter |  |

### deployer


`deployer()`  external

The pool deployer




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IAlgebraPoolDeployer |  |

### setIncentiveMaker


`setIncentiveMaker(address)`  external

Updates the incentive maker



| Name | Type | Description |
| ---- | ---- | ----------- |
| _incentiveMaker | address | The new incentive maker address |


### incentives


`incentives(bytes32)` view external

Represents a farming incentive



| Name | Type | Description |
| ---- | ---- | ----------- |
| incentiveId | bytes32 | The ID of the incentive computed from its parameters |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| totalReward | uint256 |  |
| bonusReward | uint256 |  |
| virtualPoolAddress | address |  |
| totalLiquidity | uint224 |  |
| multiplierToken | address |  |
| tiers | struct IAlgebraFarming.Tiers |  |

### detachIncentive


`detachIncentive(struct IIncentiveKey.IncentiveKey)`  external

Detach incentive from the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | The key of the incentive |


### attachIncentive


`attachIncentive(struct IIncentiveKey.IncentiveKey)`  external

Attach incentive to the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | The key of the incentive |


### rewards


`rewards(address,contract IERC20Minimal)` view external

Returns amounts of reward tokens owed to a given address according to the last time all farms were updated



| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The owner for which the rewards owed are checked |
| rewardToken | contract IERC20Minimal | The token for which to check rewards |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardsOwed | uint256 |  |

### setFarmingCenterAddress


`setFarmingCenterAddress(address)`  external

Updates farming center address



| Name | Type | Description |
| ---- | ---- | ----------- |
| _farmingCenter | address | The new farming center contract address |


### enterFarming


`enterFarming(struct IIncentiveKey.IncentiveKey,uint256,uint256)`  external

enter farming for Algebra LP token



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | The key of the incentive for which to enterFarming the NFT |
| tokenId | uint256 | The ID of the token to exitFarming |
| tokensLocked | uint256 | The amount of tokens locked for boost |


### exitFarming


`exitFarming(struct IIncentiveKey.IncentiveKey,uint256,address)`  external

exitFarmings for Algebra LP token



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | The key of the incentive for which to exitFarming the NFT |
| tokenId | uint256 | The ID of the token to exitFarming |
| _owner | address | Owner of the token |


### claimReward


`claimReward(contract IERC20Minimal,address,uint256)`  external

Transfers &#x60;amountRequested&#x60; of accrued &#x60;rewardToken&#x60; rewards from the contract to the recipient &#x60;to&#x60;



| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardToken | contract IERC20Minimal | The token being distributed as a reward |
| to | address | The address where claimed rewards will be sent to |
| amountRequested | uint256 | The amount of reward tokens to claim. Claims entire reward amount if set to 0. |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 |  |

### claimRewardFrom


`claimRewardFrom(contract IERC20Minimal,address,address,uint256)`  external

Transfers &#x60;amountRequested&#x60; of accrued &#x60;rewardToken&#x60; rewards from the contract to the recipient &#x60;to&#x60;
only for FarmingCenter



| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardToken | contract IERC20Minimal | The token being distributed as a reward |
| from | address | The address of position owner |
| to | address | The address where claimed rewards will be sent to |
| amountRequested | uint256 | The amount of reward tokens to claim. Claims entire reward amount if set to 0. |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 |  |

### getRewardInfo


`getRewardInfo(struct IIncentiveKey.IncentiveKey,uint256)`  external

Calculates the reward amount that will be received for the given farm



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | The key of the incentive |
| tokenId | uint256 | The ID of the token |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 |  |
| bonusReward | uint256 |  |



---


