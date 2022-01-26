

# IAlgebraFarming


## Events
### IncentiveCreated


`IncentiveCreated(contract IERC20Minimal,contract IERC20Minimal,contract IAlgebraPool,address,uint256,uint256,address,uint256,uint256)`  

Event emitted when a liquidity mining incentive has been created



| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardToken | contract IERC20Minimal | The token being distributed as a reward |
| bonusRewardToken | contract IERC20Minimal | The token being distributed as a bonus reward |
| pool | contract IAlgebraPool | The Algebra pool |
| virtualPool | address | The virtual pool address |
| startTime | uint256 | The time when the incentive program begins |
| endTime | uint256 | The time when rewards stop accruing |
| refundee | address | The address which receives any remaining reward tokens after the end time |
| reward | uint256 | The amount of reward tokens to be distributed |
| bonusReward | uint256 | The amount of bonus reward tokens to be distributed |


### DepositTransferred


`DepositTransferred(uint256,address,address)`  

Emitted when ownership of a deposit changes



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the deposit (and token) that is being transferred |
| oldOwner | address | The owner before the deposit was transferred |
| newOwner | address | The owner after the deposit was transferred |


### FarmStarted


`FarmStarted(uint256,uint256,bytes32,uint128)`  

Event emitted when a Algebra LP token has been farmd



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The unique identifier of an Algebra LP token |
| L2tokenId | uint256 | The unique identifier of an Algebra Farming token |
| incentiveId | bytes32 | The incentive in which the token is farming |
| liquidity | uint128 | The amount of liquidity farmd |


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


### IncentiveMakerChanged


`IncentiveMakerChanged(address,address)`  

Emitted when the incentive maker is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| incentiveMaker | address | The incentive maker address before the address was changed |
| _incentiveMaker | address | The factorincentive maker address after the address was changed |


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
### deployer


`deployer()` view external

The pool deployer with which this farming contract is compatible




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IAlgebraPoolDeployer |  |

### nonfungiblePositionManager


`nonfungiblePositionManager()` view external

The nonfungible position manager with which this farming contract is compatible




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract INonfungiblePositionManager |  |

### vdeployer


`vdeployer()` view external

The virtual pool deployer with which this farming contract is compatible




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IVirtualPoolDeployer |  |

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
| numberOfFarms | uint96 |  |
| isPoolCreated | bool |  |
| totalLiquidity | uint224 |  |

### deposits


`deposits(uint256)` view external

Returns information about a deposited NFT



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| L2TokenId | uint256 |  |
| owner | address |  |
| tickLower | int24 |  |
| tickUpper | int24 |  |

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

### setIncentiveMaker


`setIncentiveMaker(address)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _incentiveMaker | address |  |


### rewards


`rewards(contract IERC20Minimal,address)` view external

Returns amounts of reward tokens owed to a given address according to the last time all farms were updated



| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardToken | contract IERC20Minimal | The token for which to check rewards |
| owner | address | The owner for which the rewards owed are checked |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardsOwed | uint256 |  |

### createIncentive


`createIncentive(struct IAlgebraFarming.IncentiveKey,uint256,uint256)`  external

Creates a new liquidity mining incentive program



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IAlgebraFarming.IncentiveKey | Details of the incentive to create |
| reward | uint256 | The amount of reward tokens to be distributed |
| bonusReward | uint256 | The amount of bonus reward tokens to be distributed |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPool | address |  |

### withdrawToken


`withdrawToken(uint256,address,bytes)`  external

Withdraws a Algebra LP token &#x60;tokenId&#x60; from this contract to the recipient &#x60;to&#x60;



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The unique identifier of an Algebra LP token |
| to | address | The address where the LP token will be sent |
| data | bytes | An optional data array that will be passed along to the &#x60;to&#x60; address via the NFT safeTransferFrom |


### enterFarming


`enterFarming(struct IAlgebraFarming.IncentiveKey,uint256)`  external

Farms a Algebra LP token



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IAlgebraFarming.IncentiveKey | The key of the incentive for which to farm the NFT |
| tokenId | uint256 | The ID of the token to farm |


### exitFarming


`exitFarming(struct IAlgebraFarming.IncentiveKey,uint256)`  external

exitFarmings a Algebra LP token



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IAlgebraFarming.IncentiveKey | The key of the incentive for which to exitFarming the NFT |
| tokenId | uint256 | The ID of the token to exitFarming |


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

### getRewardInfo


`getRewardInfo(struct IAlgebraFarming.IncentiveKey,uint256)`  external

Calculates the reward amount that will be received for the given farm



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IAlgebraFarming.IncentiveKey | The key of the incentive |
| tokenId | uint256 | The ID of the token |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 |  |
| bonusReward | uint256 |  |



---


