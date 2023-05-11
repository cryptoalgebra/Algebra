

# ILimitOrderManager







## Functions
# limitPositions


`function limitPositions(uint256 tokenId) external view returns (struct ILimitOrderManager.LimitPosition position, address token0, address token1)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| position | struct ILimitOrderManager.LimitPosition |  |
| token0 | address |  |
| token1 | address |  |

# decreaseLimitOrder


`function decreaseLimitOrder(uint256 tokenId, uint128 liquidity) external payable` payable external





| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |
| liquidity | uint128 |  |


# collectLimitOrder


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

# addLimitOrder


`function addLimitOrder(struct ILimitOrderManager.addLimitOrderParams params) external payable returns (uint256 tokenId)` payable external





| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct ILimitOrderManager.addLimitOrderParams |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |

# burn


`function burn(uint256 tokenId) external payable` payable external

Burns a token ID, which deletes it from the NFT contract. The token must have 0 liquidity and all tokens
must be collected first.



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token that is being burned |




---


