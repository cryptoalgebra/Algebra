

# NonfungibleTokenPositionDescriptor


Describes NFT token positions

Produces a string containing the data URI for a JSON metadata string

*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-periphery*

**Inherits:** [INonfungibleTokenPositionDescriptor](interfaces/INonfungibleTokenPositionDescriptor.md)

## Structs
### TokenRatioSortData



```solidity
struct TokenRatioSortData {
  address tokenAddress;
  int256 tokenRatioSortOrder;
}
```


## Public variables
### WNativeToken
```solidity
address immutable WNativeToken
```
**Selector**: `0x8af3ac85`




### cachedThis
```solidity
address immutable cachedThis
```
**Selector**: `0x8ba7888d`





## Functions
### constructor

```solidity
constructor(address _WNativeToken, string _nativeCurrencySymbol_, struct NonfungibleTokenPositionDescriptor.TokenRatioSortData[] tokenDatas) public
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| _WNativeToken | address |  |
| _nativeCurrencySymbol_ | string |  |
| tokenDatas | struct NonfungibleTokenPositionDescriptor.TokenRatioSortData[] |  |

### tokenRatioPriority

```solidity
function tokenRatioPriority(address token) public view returns (int256)
```
**Selector**: `0x7d4a8689`



| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | int256 |  |

### nativeCurrencySymbol

```solidity
function nativeCurrencySymbol() public view returns (string)
```
**Selector**: `0xe1e06b9f`



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string |  |

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

### flipRatio

```solidity
function flipRatio(address token0, address token1) public view returns (bool)
```
**Selector**: `0xdee91a2c`



| Name | Type | Description |
| ---- | ---- | ----------- |
| token0 | address |  |
| token1 | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

