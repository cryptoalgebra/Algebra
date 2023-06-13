

# NonfungibleTokenPositionDescriptor


Describes NFT token positions

Produces a string containing the data URI for a JSON metadata string

*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-periphery*



## Variables
### address WNativeToken immutable




## Functions
### constructor


`constructor(address _WNativeToken) public`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _WNativeToken | address |  |


### tokenURI


`function tokenURI(contract INonfungiblePositionManager positionManager, uint256 tokenId) external view returns (string)` view external

Produces the URI describing a particular token ID for a position manager
*Developer note: Note this URI may be a data: URI with the JSON contents directly inlined*



| Name | Type | Description |
| ---- | ---- | ----------- |
| positionManager | contract INonfungiblePositionManager | The position manager for which to describe the token |
| tokenId | uint256 | The ID of the token for which to produce a description, which may not be valid |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string | The URI of the ERC721-compliant metadata |

### flipRatio


`function flipRatio(address token0, address token1, uint256 chainId) public view returns (bool)` view public





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


`function tokenRatioPriority(address token, uint256 chainId) public view returns (int256)` view public





| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address |  |
| chainId | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | int256 |  |




