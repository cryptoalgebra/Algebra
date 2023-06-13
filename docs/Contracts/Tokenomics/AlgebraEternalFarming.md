

# AlgebraEternalFarming


Algebra eternal (v2-like) farming






## Variables
### mapping(uint256 &#x3D;&gt; mapping(bytes32 &#x3D;&gt; struct AlgebraEternalFarming.Farm)) farms 

Returns information about a farmd liquidity NFT

*Developer note: farms[tokenId][incentiveHash] &#x3D;&gt; Farm*

## Functions
### constructor


`constructor(contract IAlgebraPoolDeployer _deployer, contract INonfungiblePositionManager _nonfungiblePositionManager) public`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _deployer | contract IAlgebraPoolDeployer | pool deployer contract address |
| _nonfungiblePositionManager | contract INonfungiblePositionManager | the NFT position manager contract address |


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

### detachIncentive


`function detachIncentive(struct IIncentiveKey.IncentiveKey key) external`  external

Detach incentive from the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | The key of the incentive |


### attachIncentive


`function attachIncentive(struct IIncentiveKey.IncentiveKey key) external`  external

Attach incentive to the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | The key of the incentive |


### addRewards


`function addRewards(struct IIncentiveKey.IncentiveKey key, uint256 rewardAmount, uint256 bonusRewardAmount) external`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey |  |
| rewardAmount | uint256 |  |
| bonusRewardAmount | uint256 |  |


### setRates


`function setRates(struct IIncentiveKey.IncentiveKey key, uint128 rewardRate, uint128 bonusRewardRate) external`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey |  |
| rewardRate | uint128 |  |
| bonusRewardRate | uint128 |  |


### enterFarming


`function enterFarming(struct IIncentiveKey.IncentiveKey key, uint256 tokenId, uint256 tokensLocked) external`  external

enter farming for Algebra LP token



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | The key of the incentive for which to enterFarming the NFT |
| tokenId | uint256 | The ID of the token to exitFarming |
| tokensLocked | uint256 | The amount of tokens locked for boost |


### exitFarming


`function exitFarming(struct IIncentiveKey.IncentiveKey key, uint256 tokenId, address _owner) external`  external

exitFarmings for Algebra LP token



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | The key of the incentive for which to exitFarming the NFT |
| tokenId | uint256 | The ID of the token to exitFarming |
| _owner | address | Owner of the token |


### getRewardInfo


`function getRewardInfo(struct IIncentiveKey.IncentiveKey key, uint256 tokenId) external view returns (uint256 reward, uint256 bonusReward)` view external

reward amounts can be outdated, actual amounts could be obtained via static call of &#x60;collectRewards&#x60; in FarmingCenter



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | The key of the incentive |
| tokenId | uint256 | The ID of the token |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 | The reward accrued to the NFT for the given incentive thus far |
| bonusReward | uint256 | The bonus reward accrued to the NFT for the given incentive thus far |

### collectRewards


`function collectRewards(struct IIncentiveKey.IncentiveKey key, uint256 tokenId, address _owner) external returns (uint256 reward, uint256 bonusReward)`  external

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




