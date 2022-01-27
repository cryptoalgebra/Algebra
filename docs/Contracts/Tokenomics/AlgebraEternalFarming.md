

# AlgebraEternalFarming

## Modifiers
### onlyIncentiveMaker









### onlyOwner









### onlyFarmingCenter











## Variables
### contract INonfungiblePositionManager nonfungiblePositionManager immutable

The nonfungible position manager with which this farming contract is compatible

### contract IAlgebraPoolDeployer deployer immutable



### uint256 maxIncentiveStartLeadTime immutable

The max amount of seconds into the future the incentive startTime can be set

### uint256 maxIncentiveDuration immutable

The max duration of an incentive in seconds

### contract IFarmingCenter farmingCenter 

FarmingCenter

### mapping(bytes32 &#x3D;&gt; struct AlgebraEternalFarming.Incentive) incentives 



*Developer note: bytes32 refers to the return value of IncentiveId.compute*
### mapping(uint256 &#x3D;&gt; mapping(bytes32 &#x3D;&gt; struct AlgebraEternalFarming.Farm)) farms 



*Developer note: farms[tokenId][incentiveHash] &#x3D;&gt; Farm*
### mapping(contract IERC20Minimal &#x3D;&gt; mapping(address &#x3D;&gt; uint256)) rewards 

Returns amounts of reward tokens owed to a given address according to the last time all farms were updated

*Developer note: rewards[rewardToken][owner] &#x3D;&gt; uint256*

## Functions
### setIncentiveMaker

onlyOwner

`setIncentiveMaker(address)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _incentiveMaker | address |  |


### setFarmingCenterAddress

onlyOwner

`setFarmingCenterAddress(address)`  external

@notice



| Name | Type | Description |
| ---- | ---- | ----------- |
| _farmingCenter | address |  |


### constructor


`constructor(contract IAlgebraPoolDeployer,contract INonfungiblePositionManager,uint256,uint256)`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _deployer | contract IAlgebraPoolDeployer | pool deployer contract address |
| _nonfungiblePositionManager | contract INonfungiblePositionManager | the NFT position manager contract address |
| _maxIncentiveStartLeadTime | uint256 | the max duration of an incentive in seconds |
| _maxIncentiveDuration | uint256 | the max amount of seconds into the future the incentive startTime can be set |


### createIncentive

onlyIncentiveMaker

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

### detachIncentive

onlyIncentiveMaker

`detachIncentive(struct IIncentiveKey.IncentiveKey)`  external

Detach incentive from the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | The key of the incentive |


### attachIncentive

onlyIncentiveMaker

`attachIncentive(struct IIncentiveKey.IncentiveKey)`  external

Attach incentive to the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | The key of the incentive |


### addRewards


`addRewards(struct IIncentiveKey.IncentiveKey,uint256,uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey |  |
| rewardAmount | uint256 |  |
| bonusRewardAmount | uint256 |  |


### setRates

onlyIncentiveMaker

`setRates(struct IIncentiveKey.IncentiveKey,uint128,uint128)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey |  |
| rewardRate | uint128 |  |
| bonusRewardRate | uint128 |  |


### enterFarming

onlyFarmingCenter

`enterFarming(struct IIncentiveKey.IncentiveKey,uint256)`  external

Farms a Algebra LP token



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | The key of the incentive for which to farm the NFT |
| tokenId | uint256 | The ID of the token to farm |


### exitFarming

onlyFarmingCenter

`exitFarming(struct IIncentiveKey.IncentiveKey,uint256,address)`  external

exitFarmings for Algebra LP token



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | The key of the incentive for which to exitFarming the NFT |
| tokenId | uint256 | The ID of the token to exitFarming |
| _owner | address |  |


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

onlyFarmingCenter

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


`getRewardInfo(struct IIncentiveKey.IncentiveKey,uint256)` view external

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

### collectRewards

onlyFarmingCenter

`collectRewards(struct IIncentiveKey.IncentiveKey,uint256,address)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey |  |
| tokenId | uint256 |  |
| _owner | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |
| [1] | uint256 |  |



---


