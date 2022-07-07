

# NonfungibleTokenPositionDescriptor

Describes NFT token positions
Produces a string containing the data URI for a JSON metadata string



## Variables
### address WNativeToken immutable




## Functions
### constructor


`constructor(address)`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _WNativeToken | address |  |


### tokenURI


`tokenURI(contract INonfungiblePositionManager,uint256)` view external

Produces the URI describing a particular token ID for a position manager



| Name | Type | Description |
| ---- | ---- | ----------- |
| positionManager | contract INonfungiblePositionManager | The position manager for which to describe the token |
| tokenId | uint256 | The ID of the token for which to produce a description, which may not be valid |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string |  |

### flipRatio


`flipRatio(address,address,uint256)` view public





| Name | Type | Description |
| ---- | ---- | ----------- |
| token0 | address |  |
| token1 | address |  |
| chainId | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

### tokenRatioPriority


`tokenRatioPriority(address,uint256)` view public





| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address |  |
| chainId | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | int256 |  |



---


