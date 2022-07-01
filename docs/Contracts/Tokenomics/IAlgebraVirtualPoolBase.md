

# IAlgebraVirtualPoolBase

Base interface for virtual pools





## Functions
### timeOutside


`timeOutside()`  external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

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

### currentLiquidity


`currentLiquidity()`  external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 |  |

### globalTick


`globalTick()`  external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | int24 |  |

### globalSecondsPerLiquidityCumulative


`globalSecondsPerLiquidityCumulative()`  external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint160 |  |

### prevTimestamp


`prevTimestamp()`  external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

### applyLiquidityDeltaToPosition


`applyLiquidityDeltaToPosition(uint32,int24,int24,int128,int24)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| currentTimestamp | uint32 |  |
| bottomTick | int24 | The bottom tick of a position |
| topTick | int24 | The top tick of a position |
| liquidityDelta | int128 | The amount of liquidity in a position |
| tick | int24 | The current tick in the main pool |




---


