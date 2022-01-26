

# IAlgebraIncentiveVirtualPool




## Functions
### desiredEndTimestamp


`desiredEndTimestamp()`  external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

### desiredStartTimestamp


`desiredStartTimestamp()`  external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

### initTimestamp


`initTimestamp()`  external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

### endTimestamp


`endTimestamp()`  external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

### timeOutside


`timeOutside()`  external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

### globalSecondsPerLiquidityCumulative


`globalSecondsPerLiquidityCumulative()`  external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint160 |  |

### prevLiquidity


`prevLiquidity()`  external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 |  |

### currentLiquidity


`currentLiquidity()`  external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 |  |

### prevTimestamp


`prevTimestamp()`  external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

### globalTick


`globalTick()`  external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | int24 |  |

### ticks


`ticks(int24)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| tickId | int24 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidityTotal | uint128 |  |
| liquidityDelta | int128 |  |
| outerFeeGrowth0Token | uint256 |  |
| outerFeeGrowth1Token | uint256 |  |
| outerTickCumulative | int56 |  |
| outerSecondsPerLiquidity | uint160 |  |
| outerSecondsSpent | uint32 |  |
| initialized | bool |  |

### applyLiquidityDeltaToPosition


`applyLiquidityDeltaToPosition(int24,int24,int128,int24)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 | The bottom tick of a position |
| topTick | int24 | The top tick of a position |
| liquidityDelta | int128 | The amount of liquidity in a position |
| tick | int24 | The current tick in the main pool |


### finish


`finish(uint32,uint32)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _endTimestamp | uint32 | The timestamp of the exitFarming |
| startTime | uint32 | The timestamp of planned start of the incentive. Used as initTimestamp if there were no swaps through the entire incentive |


### getInnerSecondsPerLiquidity


`getInnerSecondsPerLiquidity(int24,int24)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 | The bottom tick of a position |
| topTick | int24 | The top tick of a position |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| innerSecondsSpentPerLiquidity | uint160 |  |
| initTime | uint32 |  |
| endTime | uint32 |  |



---


