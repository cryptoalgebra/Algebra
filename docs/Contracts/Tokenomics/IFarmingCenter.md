

# IFarmingCenter


## Events
### DepositTransferred


`DepositTransferred(uint256,address,address)`  

Emitted when ownership of a deposit changes



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the deposit (and token) that is being transferred |
| oldOwner | address | The owner before the deposit was transferred |
| newOwner | address | The owner after the deposit was transferred |




## Functions
### virtualPoolAddresses


`virtualPoolAddresses(address)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |
| [1] | address |  |

### nonfungiblePositionManager


`nonfungiblePositionManager()` view external

The nonfungible position manager with which this farming contract is compatible




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract INonfungiblePositionManager |  |

### farming


`farming()` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IAlgebraIncentiveFarming |  |

### eternalFarming


`eternalFarming()` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IAlgebraEternalFarming |  |

### l2Nfts


`l2Nfts(uint256)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
|  | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| nonce | uint96 |  |
| operator | address |  |
| tokenId | uint256 |  |

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
| tickLower | int24 |  |
| tickUpper | int24 |  |
| numberOfFarms | uint32 |  |
| owner | address |  |

### setFarmingCenterAddress


`setFarmingCenterAddress(contract IAlgebraPool,address)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | contract IAlgebraPool |  |
| virtualPool | address |  |


### enterEternalFarming


`enterEternalFarming(struct IIncentiveKey.IncentiveKey,uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey |  |
| tokenId | uint256 |  |


### exitEternalFarming


`exitEternalFarming(struct IIncentiveKey.IncentiveKey,uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey |  |
| tokenId | uint256 |  |


### collect


`collect(struct INonfungiblePositionManager.CollectParams)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct INonfungiblePositionManager.CollectParams |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint256 |  |
| amount1 | uint256 |  |

### collectRewards


`collectRewards(struct IIncentiveKey.IncentiveKey,uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey |  |
| tokenId | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 |  |
| bonusReward | uint256 |  |

### claimReward


`claimReward(contract IERC20Minimal,address,uint256,uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardToken | contract IERC20Minimal |  |
| to | address |  |
| amountRequestedIncentive | uint256 |  |
| amountRequestedEternal | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 |  |

### enterFarming


`enterFarming(struct IIncentiveKey.IncentiveKey,uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey |  |
| tokenId | uint256 |  |


### exitFarming


`exitFarming(struct IIncentiveKey.IncentiveKey,uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey |  |
| tokenId | uint256 |  |


### withdrawToken


`withdrawToken(uint256,address,bytes)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |
| to | address |  |
| data | bytes |  |




---


