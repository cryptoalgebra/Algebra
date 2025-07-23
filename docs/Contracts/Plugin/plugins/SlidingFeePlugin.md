

# SlidingFeePlugin






**Inherits:** [BasePlugin](../base/BasePlugin.md) [ISlidingFeePlugin](../interfaces/plugins/ISlidingFeePlugin.md)

## Structs
### FeeFactors



```solidity
struct FeeFactors {
  uint128 zeroToOneFeeFactor;
  uint128 oneToZeroFeeFactor;
}
```


## Public variables
### s_feeFactors
```solidity
struct SlidingFeePlugin.FeeFactors s_feeFactors
```
**Selector**: `0x58e31bfd`




### s_priceChangeFactor
```solidity
uint16 s_priceChangeFactor
```
**Selector**: `0x7b3de5c6`




### s_baseFee
```solidity
uint16 s_baseFee
```
**Selector**: `0x08cd1975`





## Functions
### setPriceChangeFactor

```solidity
function setPriceChangeFactor(uint16 newPriceChangeFactor) external
```
**Selector**: `0xa37a8456`



| Name | Type | Description |
| ---- | ---- | ----------- |
| newPriceChangeFactor | uint16 |  |

### setBaseFee

```solidity
function setBaseFee(uint16 newBaseFee) external
```
**Selector**: `0x3b586c7f`



| Name | Type | Description |
| ---- | ---- | ----------- |
| newBaseFee | uint16 |  |

