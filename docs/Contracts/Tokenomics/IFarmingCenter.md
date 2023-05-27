

# IFarmingCenter










## Functions
### virtualPoolAddresses


`function virtualPoolAddresses(address) external view returns (address)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

### nonfungiblePositionManager


`function nonfungiblePositionManager() external view returns (contract INonfungiblePositionManager)` view external

The nonfungible position manager with which this farming contract is compatible




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract INonfungiblePositionManager |  |

### eternalFarming


`function eternalFarming() external view returns (contract IAlgebraEternalFarming)` view external

The eternal farming contract




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IAlgebraEternalFarming |  |

### algebraPoolDeployer


`function algebraPoolDeployer() external view returns (address)` view external

The Algebra poolDeployer contract




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

### deposits


`function deposits(uint256 tokenId) external view returns (bytes32 eternalIncentiveId)` view external

Returns information about a deposited NFT



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the deposit (and token) that is being transferred |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| eternalIncentiveId | bytes32 | The id of eternal incentive that is active for this NFT |

### connectVirtualPool


`function connectVirtualPool(contract IAlgebraPool pool, address virtualPool) external`  external

Updates activeIncentive in AlgebraPool
*Developer note: only farming can do it*



| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | contract IAlgebraPool | The AlgebraPool for which farming was created |
| virtualPool | address | The virtual pool to be connected |


### enterFarming


`function enterFarming(struct IncentiveKey key, uint256 tokenId) external`  external

Enters in incentive (time-limited or eternal farming) with NFT-position token
*Developer note: token must be deposited in FarmingCenter*



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | The incentive event key |
| tokenId | uint256 | The id of position NFT |


### exitFarming


`function exitFarming(struct IncentiveKey key, uint256 tokenId) external`  external

Exits from incentive (time-limited or eternal farming) with NFT-position token



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | The incentive event key |
| tokenId | uint256 | The id of position NFT |


### collectRewards


`function collectRewards(struct IncentiveKey key, uint256 tokenId) external returns (uint256 reward, uint256 bonusReward)`  external

Used to collect reward from eternal farming. Then reward can be claimed.



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | The incentive event key |
| tokenId | uint256 | The id of position NFT |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 | The amount of collected reward |
| bonusReward | uint256 | The amount of collected  bonus reward |

### claimReward


`function claimReward(contract IERC20Minimal rewardToken, address to, uint256 amountRequested) external returns (uint256 reward)`  external

Used to claim and send rewards from farming(s)
*Developer note: can be used via static call to get current rewards for user*



| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardToken | contract IERC20Minimal | The token that is a reward |
| to | address | The address to be rewarded |
| amountRequested | uint256 | Amount to claim in eternal farming |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 | The summary amount of claimed rewards |




