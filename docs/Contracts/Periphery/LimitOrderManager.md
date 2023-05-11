

# LimitOrderManager


NFT limitPositions

Wraps Algebra  limitPositions in the ERC721 non-fungible token interface


## Modifiers
### isAuthorizedForToken


`modifier isAuthorizedForToken(uint256 tokenId)`  internal





| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |





## Functions
### constructor


`constructor(address _factory, address _WNativeToken, address _poolDeployer) public`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _factory | address |  |
| _WNativeToken | address |  |
| _poolDeployer | address |  |


### limitPositions


`function limitPositions(uint256 tokenId) external view returns (struct ILimitOrderManager.LimitPosition limitPosition, address token0, address token1)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| limitPosition | struct ILimitOrderManager.LimitPosition |  |
| token0 | address |  |
| token1 | address |  |

### addLimitOrder


`function addLimitOrder(struct ILimitOrderManager.addLimitOrderParams params) external payable returns (uint256 tokenId)` payable external





| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct ILimitOrderManager.addLimitOrderParams |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |

### decreaseLimitOrder


`function decreaseLimitOrder(uint256 tokenId, uint128 liquidity) external payable` payable external





| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |
| liquidity | uint128 |  |


### collectLimitOrder


`function collectLimitOrder(uint256 tokenId, address recipient) external payable returns (uint256 amount0, uint256 amount1)` payable external





| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |
| recipient | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint256 |  |
| amount1 | uint256 |  |

### baseURI


`function baseURI() public pure returns (string)` pure public






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string |  |

### burn


`function burn(uint256 tokenId) external payable` payable external

Burns a token ID, which deletes it from the NFT contract. The token must have 0 liquidity and all tokens
must be collected first.



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token that is being burned |


### getApproved


`function getApproved(uint256 tokenId) public view returns (address)` view public


*Developer note: Returns the account approved for &#x60;tokenId&#x60; token.

Requirements:

- &#x60;tokenId&#x60; must exist.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |





---

