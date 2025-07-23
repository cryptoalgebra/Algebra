

# IRebalanceManager







## Events
### SetPriceChangeThreshold

```solidity
event SetPriceChangeThreshold(uint16 priceChangeThreshold)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| priceChangeThreshold | uint16 |  |

### SetPercentages

```solidity
event SetPercentages(uint16 baseLowPct, uint16 baseHighPct, uint16 limitReservePct)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| baseLowPct | uint16 |  |
| baseHighPct | uint16 |  |
| limitReservePct | uint16 |  |

### SetTriggers

```solidity
event SetTriggers(uint16 simulate, uint16 normalThreshold, uint16 underInventoryThreshold, uint16 overInventoryThreshold)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| simulate | uint16 |  |
| normalThreshold | uint16 |  |
| underInventoryThreshold | uint16 |  |
| overInventoryThreshold | uint16 |  |

### SetDtrDelta

```solidity
event SetDtrDelta(uint16 dtrDelta)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| dtrDelta | uint16 |  |

### SetHighVolatility

```solidity
event SetHighVolatility(uint16 highVolatility)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| highVolatility | uint16 |  |

### SetSomeVolatility

```solidity
event SetSomeVolatility(uint16 someVolatility)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| someVolatility | uint16 |  |

### SetExtremeVolatility

```solidity
event SetExtremeVolatility(uint16 extremeVolatility)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| extremeVolatility | uint16 |  |

### SetDepositTokenUnusedThreshold

```solidity
event SetDepositTokenUnusedThreshold(uint16 depositTokenUnusedThreshold)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| depositTokenUnusedThreshold | uint16 |  |

### SetMinTimeBetweenRebalances

```solidity
event SetMinTimeBetweenRebalances(uint32 minTimeBetweenRebalances)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| minTimeBetweenRebalances | uint32 |  |

### SetVault

```solidity
event SetVault(address vault)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| vault | address |  |

### Paused

```solidity
event Paused()
```



### Unpaused

```solidity
event Unpaused()
```




## Functions
### obtainTWAPAndRebalance

```solidity
function obtainTWAPAndRebalance(int24 currentTick, int24 slowTwapTick, int24 fastTwapTick, uint32 lastBlockTimestamp) external
```
**Selector**: `0x7e7b25f1`



| Name | Type | Description |
| ---- | ---- | ----------- |
| currentTick | int24 |  |
| slowTwapTick | int24 |  |
| fastTwapTick | int24 |  |
| lastBlockTimestamp | uint32 |  |

