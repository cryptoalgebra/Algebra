

# FarmingCenter

## Modifiers
### isAuthorizedForToken









### onlyFarming











## Variables
### contract IAlgebraIncentiveFarming farming immutable



### contract IAlgebraEternalFarming eternalFarming immutable



### contract INonfungiblePositionManager nonfungiblePositionManager immutable



### mapping(uint256 &#x3D;&gt; struct FarmingCenter.Deposit) deposits 



*Developer note: deposits[tokenId] &#x3D;&gt; Deposit*
### mapping(uint256 &#x3D;&gt; struct FarmingCenter.L2Nft) l2Nfts 




## Functions
### constructor

ERC721Permit, PeripheryPayments

`constructor(contract IAlgebraIncentiveFarming,contract IAlgebraEternalFarming,contract INonfungiblePositionManager)`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _farming | contract IAlgebraIncentiveFarming |  |
| _eternalFarming | contract IAlgebraEternalFarming |  |
| _nonfungiblePositionManager | contract INonfungiblePositionManager |  |


### onERC721Received


`onERC721Received(address,address,uint256,bytes)`  external

Upon receiving a Algebra ERC721, creates the token deposit setting owner to &#x60;from&#x60;. Also farms token
in one or more incentives if properly formatted &#x60;data&#x60; has a length &gt; 0.



| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |
| from | address |  |
| tokenId | uint256 |  |
|  | bytes |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes4 |  |

### enterEternalFarming

isAuthorizedForToken

`enterEternalFarming(struct IIncentiveKey.IncentiveKey,uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey |  |
| tokenId | uint256 |  |


### exitEternalFarming

isAuthorizedForToken

`exitEternalFarming(struct IIncentiveKey.IncentiveKey,uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey |  |
| tokenId | uint256 |  |


### enterFarming

isAuthorizedForToken

`enterFarming(struct IIncentiveKey.IncentiveKey,uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey |  |
| tokenId | uint256 |  |


### exitFarming

isAuthorizedForToken

`exitFarming(struct IIncentiveKey.IncentiveKey,uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey |  |
| tokenId | uint256 |  |


### collectFees

isAuthorizedForToken

`collectFees(struct INonfungiblePositionManager.CollectParams)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct INonfungiblePositionManager.CollectParams |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint256 |  |
| amount1 | uint256 |  |

### collectRewards

isAuthorizedForToken

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

### setFarmingCenterAddress

onlyFarming

`setFarmingCenterAddress(contract IAlgebraPool,address)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | contract IAlgebraPool |  |
| virtualPool | address |  |


### withdrawToken

isAuthorizedForToken

`withdrawToken(uint256,address,bytes)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |
| to | address |  |
| data | bytes |  |


### processSwap


`processSwap()`  external







### cross


`cross(int24,bool)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| nextTick | int24 |  |
| zeroForOne | bool |  |


### virtualPoolAddresses


`virtualPoolAddresses(address)` view public





| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| incentiveVP | address |  |
| eternalVP | address |  |

### getApproved


`getApproved(uint256)` view public





| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

### increaseCumulative


`increaseCumulative(uint32)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| blockTimestamp | uint32 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | enum IAlgebraVirtualPool.Status |  |



---


