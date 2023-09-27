

# NFTDescriptor






*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-periphery*


## Structs
### ConstructTokenURIParams



```solidity
struct ConstructTokenURIParams {
  uint256 tokenId;
  address quoteTokenAddress;
  address baseTokenAddress;
  string quoteTokenSymbol;
  string baseTokenSymbol;
  uint8 quoteTokenDecimals;
  uint8 baseTokenDecimals;
  bool flipRatio;
  int24 tickLower;
  int24 tickUpper;
  int24 tickCurrent;
  int24 tickSpacing;
  address poolAddress;
}
```

### DecimalStringParams



```solidity
struct DecimalStringParams {
  uint256 sigfigs;
  uint8 bufferLength;
  uint8 sigfigIndex;
  uint8 decimalIndex;
  uint8 zerosStartIndex;
  uint8 zerosEndIndex;
  bool isLessThanOne;
  bool isPercent;
}
```

### FeeDigits



```solidity
struct FeeDigits {
  uint24 temp;
  uint8 numSigfigs;
  uint256 digits;
}
```


## Functions
### constructTokenURI

```solidity
function constructTokenURI(struct NFTDescriptor.ConstructTokenURIParams params) public pure returns (string)
```
**Selector**: `0xc49917d7`



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct NFTDescriptor.ConstructTokenURIParams |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string |  |

