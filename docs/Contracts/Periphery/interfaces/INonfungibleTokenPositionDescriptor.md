

# INonfungibleTokenPositionDescriptor


Describes position NFT tokens via URI



*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-periphery*


## Functions
### tokenURI

```solidity
function tokenURI(contract INonfungiblePositionManager positionManager, uint256 tokenId) external view returns (string)
```
**Selector**: `0xe9dc6375`

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

