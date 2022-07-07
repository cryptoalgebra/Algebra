

# AlgebraLimitFarming

Algebra incentive (time-limited) farming




## Variables
### uint256 maxIncentiveStartLeadTime immutable

The max amount of seconds into the future the incentive startTime can be set

### uint256 maxIncentiveDuration immutable

The max duration of an incentive in seconds

### mapping(uint256 &#x3D;&gt; mapping(bytes32 &#x3D;&gt; struct AlgebraLimitFarming.Farm)) farms 

Returns information about a farmd liquidity NFT

*Developer note: farms[tokenId][incentiveHash] &#x3D;&gt; Farm*

## Functions
### constructor

AlgebraFarming

`constructor(contract IAlgebraPoolDeployer,contract INonfungiblePositionManager,uint256,uint256)`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _deployer | contract IAlgebraPoolDeployer | pool deployer contract address |
| _nonfungiblePositionManager | contract INonfungiblePositionManager | the NFT position manager contract address |
| _maxIncentiveStartLeadTime | uint256 | the max duration of an incentive in seconds |
| _maxIncentiveDuration | uint256 | the max amount of seconds into the future the incentive startTime can be set |


### createLimitFarming

onlyIncentiveMaker

`createLimitFarming(struct IIncentiveKey.IncentiveKey,struct IAlgebraFarming.Tiers,struct IAlgebraLimitFarming.IncentiveParams)`  external





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

onlyIncentiveMaker

`addRewards(struct IIncentiveKey.IncentiveKey,uint256,uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey |  |
| reward | uint256 |  |
| bonusReward | uint256 |  |


### decreaseRewardsAmount

onlyIncentiveMaker

`decreaseRewardsAmount(struct IIncentiveKey.IncentiveKey,uint256,uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey |  |
| rewardAmount | uint256 |  |
| bonusRewardAmount | uint256 |  |


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


### enterFarming

onlyFarmingCenter

`enterFarming(struct IIncentiveKey.IncentiveKey,uint256,uint256)`  external

enter farming for Algebra LP token



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | The key of the incentive for which to enterFarming the NFT |
| tokenId | uint256 | The ID of the token to exitFarming |
| tokensLocked | uint256 | The amount of tokens locked for boost |


### exitFarming

onlyFarmingCenter

`exitFarming(struct IIncentiveKey.IncentiveKey,uint256,address)`  external

exitFarmings for Algebra LP token



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | The key of the incentive for which to exitFarming the NFT |
| tokenId | uint256 | The ID of the token to exitFarming |
| _owner | address | Owner of the token |


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



---


