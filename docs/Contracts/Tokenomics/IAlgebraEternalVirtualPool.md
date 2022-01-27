

# IAlgebraEternalVirtualPool




## Functions
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

### prevLiquidity


`prevLiquidity()`  external






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

### setRates


`setRates(uint128,uint128)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| rate0 | uint128 |  |
| rate1 | uint128 |  |


### addRewards


`addRewards(uint256,uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| token0Amount | uint256 |  |
| token1Amount | uint256 |  |


### getInnerRewardsGrowth


`getInnerRewardsGrowth(int24,int24)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 |  |
| topTick | int24 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardGrowthInside0 | uint256 |  |
| rewardGrowthInside1 | uint256 |  |

### applyLiquidityDeltaToPosition


`applyLiquidityDeltaToPosition(uint32,int24,int24,int128,int24)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| currentTimestamp | uint32 |  |
| bottomTick | int24 | The bottom tick of a position |
| topTick | int24 | The top tick of a position |
| liquidityDelta | int128 | The amount of liquidity in a position |
| tick | int24 | The current tick in the main pool |


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



---


