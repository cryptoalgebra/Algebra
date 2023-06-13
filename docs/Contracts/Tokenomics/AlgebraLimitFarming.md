

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


`constructor(contract IAlgebraPoolDeployer _deployer, contract INonfungiblePositionManager _nonfungiblePositionManager, uint256 _maxIncentiveStartLeadTime, uint256 _maxIncentiveDuration) public`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _deployer | contract IAlgebraPoolDeployer | pool deployer contract address |
| _nonfungiblePositionManager | contract INonfungiblePositionManager | the NFT position manager contract address |
| _maxIncentiveStartLeadTime | uint256 | the max duration of an incentive in seconds |
| _maxIncentiveDuration | uint256 | the max amount of seconds into the future the incentive startTime can be set |


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

Calculates the reward amount that will be received for the given farm



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | The key of the incentive |
| tokenId | uint256 | The ID of the token |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 | The reward accrued to the NFT for the given incentive thus far |
| bonusReward | uint256 | The bonus reward accrued to the NFT for the given incentive thus far |




