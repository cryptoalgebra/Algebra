

# AlgebraEternalFarming

Algebra eternal (v2-like) farming




## Variables
### mapping(uint256 &#x3D;&gt; mapping(bytes32 &#x3D;&gt; struct AlgebraEternalFarming.Farm)) farms 

Returns information about a farmd liquidity NFT

*Developer note: farms[tokenId][incentiveHash] &#x3D;&gt; Farm*

## Functions
### constructor

AlgebraFarming

`constructor(contract IAlgebraPoolDeployer,contract INonfungiblePositionManager)`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _deployer | contract IAlgebraPoolDeployer | pool deployer contract address |
| _nonfungiblePositionManager | contract INonfungiblePositionManager | the NFT position manager contract address |


### createEternalFarming

onlyIncentiveMaker

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

reward amounts can be outdated, actual amounts could be obtained via static call of &#x60;collectRewards&#x60; in FarmingCenter



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

reward amounts should be updated before calling this method



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


