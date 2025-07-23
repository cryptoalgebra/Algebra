

# ISlidingFeePlugin







## Events
### PriceChangeFactor

```solidity
event PriceChangeFactor(uint256 priceChangeFactor)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| priceChangeFactor | uint256 |  |

### BaseFee

```solidity
event BaseFee(uint16 baseFee)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| baseFee | uint16 |  |

### SlidingFeeStatus

```solidity
event SlidingFeeStatus(bool slidingFeeEnabled)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| slidingFeeEnabled | bool |  |


## Functions
### setBaseFee

```solidity
function setBaseFee(uint16 newBaseFee) external
```
**Selector**: `0x3b586c7f`



| Name | Type | Description |
| ---- | ---- | ----------- |
| newBaseFee | uint16 |  |

### setPriceChangeFactor

```solidity
function setPriceChangeFactor(uint16 newPriceChangeFactor) external
```
**Selector**: `0xa37a8456`



| Name | Type | Description |
| ---- | ---- | ----------- |
| newPriceChangeFactor | uint16 |  |

### changeSlidingFeeStatus

```solidity
function changeSlidingFeeStatus(bool isEnabled) external
```
**Selector**: `0xf860df9d`



| Name | Type | Description |
| ---- | ---- | ----------- |
| isEnabled | bool |  |

