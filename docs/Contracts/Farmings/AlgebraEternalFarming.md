

# AlgebraEternalFarming


Algebra eternal (v2-like) farming



## Modifiers
### onlyIncentiveMaker

```solidity
modifier onlyIncentiveMaker()
```



### onlyAdministrator

```solidity
modifier onlyAdministrator()
```



### onlyFarmingCenter

```solidity
modifier onlyFarmingCenter()
```




## Structs
### Incentive

Represents a farming incentive

```solidity
struct Incentive {
  uint128 totalReward;
  uint128 bonusReward;
  address virtualPoolAddress;
  uint24 minimalPositionWidth;
  bool deactivated;
  address pluginAddress;
}
```

### Farm

Represents the farm for nft

```solidity
struct Farm {
  uint128 liquidity;
  int24 tickLower;
  int24 tickUpper;
  uint256 innerRewardGrowth0;
  uint256 innerRewardGrowth1;
}
```


## Variables
### contract INonfungiblePositionManager nonfungiblePositionManager immutable

The nonfungible position manager with which this farming contract is compatible


### contract IFarmingCenter farmingCenter 




### bool isEmergencyWithdrawActivated 

Users can withdraw liquidity without any checks if active.


### mapping(bytes32 &#x3D;&gt; struct AlgebraEternalFarming.Incentive) incentives 

Represents a farming incentive

*Developer note: bytes32 refers to the return value of IncentiveId.compute*

### mapping(uint256 &#x3D;&gt; mapping(bytes32 &#x3D;&gt; struct AlgebraEternalFarming.Farm)) farms 

Returns information about a farmd liquidity NFT

*Developer note: farms[tokenId][incentiveHash] &#x3D;&gt; Farm*

### uint256 numOfIncentives 




### bytes32 INCENTIVE_MAKER_ROLE constant




### bytes32 FARMINGS_ADMINISTRATOR_ROLE constant




### mapping(address &#x3D;&gt; mapping(contract IERC20Minimal &#x3D;&gt; uint256)) rewards 

Returns amounts of reward tokens owed to a given address according to the last time all farms were updated

*Developer note: rewards[owner][rewardToken] &#x3D;&gt; uint256*


## Functions
### constructor

```solidity
constructor(contract IAlgebraPoolDeployer _deployer, contract INonfungiblePositionManager _nonfungiblePositionManager) public
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| _deployer | contract IAlgebraPoolDeployer | pool deployer contract address |
| _nonfungiblePositionManager | contract INonfungiblePositionManager | the NFT position manager contract address |

### isIncentiveActive

```solidity
function isIncentiveActive(bytes32 incentiveId) external view returns (bool res)
```

Check if incentive is active

*Developer note: Does not check that the incentive is indeed currently connected to the Algebra pool*

| Name | Type | Description |
| ---- | ---- | ----------- |
| incentiveId | bytes32 | The ID of the incentive computed from its parameters |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| res | bool | True if incentive is active |

### createEternalFarming

```solidity
function createEternalFarming(struct IncentiveKey key, struct IAlgebraEternalFarming.IncentiveParams params) external returns (address virtualPool)
```

Creates a new liquidity mining incentive program

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | Details of the incentive to create |
| params | struct IAlgebraEternalFarming.IncentiveParams | Params of incentive |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPool | address | The virtual pool |

### deactivateIncentive

```solidity
function deactivateIncentive(struct IncentiveKey key) external
```

Detach incentive from the pool and deactivate it

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | The key of the incentive |

### decreaseRewardsAmount

```solidity
function decreaseRewardsAmount(struct IncentiveKey key, uint128 rewardAmount, uint128 bonusRewardAmount) external
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey |  |
| rewardAmount | uint128 |  |
| bonusRewardAmount | uint128 |  |

### setFarmingCenterAddress

```solidity
function setFarmingCenterAddress(address _farmingCenter) external
```

Updates farming center address

| Name | Type | Description |
| ---- | ---- | ----------- |
| _farmingCenter | address | The new farming center contract address |

### setEmergencyWithdrawStatus

```solidity
function setEmergencyWithdrawStatus(bool newStatus) external
```

Changes &#x60;isEmergencyWithdrawActivated&#x60;. Users can withdraw liquidity without any checks if activated.
User cannot enter to farmings if activated.
_Must_ only be used in emergency situations. Farmings may be unusable after activation.

*Developer note: only farmings administrator*

| Name | Type | Description |
| ---- | ---- | ----------- |
| newStatus | bool | The new status of `isEmergencyWithdrawActivated`. |

### addRewards

```solidity
function addRewards(struct IncentiveKey key, uint128 rewardAmount, uint128 bonusRewardAmount) external
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey |  |
| rewardAmount | uint128 |  |
| bonusRewardAmount | uint128 |  |

### setRates

```solidity
function setRates(struct IncentiveKey key, uint128 rewardRate, uint128 bonusRewardRate) external
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey |  |
| rewardRate | uint128 |  |
| bonusRewardRate | uint128 |  |

### enterFarming

```solidity
function enterFarming(struct IncentiveKey key, uint256 tokenId) external
```

enter farming for Algebra LP token

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | The key of the incentive for which to enterFarming the NFT |
| tokenId | uint256 | The ID of the token to exitFarming |

### exitFarming

```solidity
function exitFarming(struct IncentiveKey key, uint256 tokenId, address _owner) external
```

exitFarmings for Algebra LP token

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | The key of the incentive for which to exitFarming the NFT |
| tokenId | uint256 | The ID of the token to exitFarming |
| _owner | address | Owner of the token |

### claimReward

```solidity
function claimReward(contract IERC20Minimal rewardToken, address to, uint256 amountRequested) external returns (uint256 reward)
```

Transfers &#x60;amountRequested&#x60; of accrued &#x60;rewardToken&#x60; rewards from the contract to the recipient &#x60;to&#x60;

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardToken | contract IERC20Minimal | The token being distributed as a reward |
| to | address | The address where claimed rewards will be sent to |
| amountRequested | uint256 | The amount of reward tokens to claim. Claims entire reward amount if set to 0. |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 | The amount of reward tokens claimed |

### claimRewardFrom

```solidity
function claimRewardFrom(contract IERC20Minimal rewardToken, address from, address to, uint256 amountRequested) external returns (uint256 reward)
```

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
| reward | uint256 | The amount of reward tokens claimed |

### getRewardInfo

```solidity
function getRewardInfo(struct IncentiveKey key, uint256 tokenId) external view returns (uint256 reward, uint256 bonusReward)
```

reward amounts can be outdated, actual amounts could be obtained via static call of &#x60;collectRewards&#x60; in FarmingCenter

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | The key of the incentive |
| tokenId | uint256 | The ID of the token |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 | The reward accrued to the NFT for the given incentive thus far |
| bonusReward | uint256 | The bonus reward accrued to the NFT for the given incentive thus far |

### collectRewards

```solidity
function collectRewards(struct IncentiveKey key, uint256 tokenId, address _owner) external returns (uint256 reward, uint256 bonusReward)
```

reward amounts should be updated before calling this method

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey |  |
| tokenId | uint256 |  |
| _owner | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 |  |
| bonusReward | uint256 |  |

