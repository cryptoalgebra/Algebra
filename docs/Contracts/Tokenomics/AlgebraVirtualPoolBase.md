

# AlgebraVirtualPoolBase


Abstract base contract for Algebra virtual pools




## Modifiers
### onlyFromPool


`modifier onlyFromPool()`  internal

only pool (or FarmingCenter as &quot;proxy&quot;) can call





### onlyFarming


`modifier onlyFarming()`  internal









## Variables
### address farmingCenterAddress immutable



### address farmingAddress immutable



### address pool immutable



### mapping(int24 &#x3D;&gt; struct TickManager.Tick) ticks 



### uint128 currentLiquidity 



### int24 globalTick 



### uint32 timeOutside 



### uint160 globalSecondsPerLiquidityCumulative 



### uint32 prevTimestamp 




## Functions
### getInnerSecondsPerLiquidity


`function getInnerSecondsPerLiquidity(int24 bottomTick, int24 topTick) external view returns (uint160 innerSecondsSpentPerLiquidity)` view external

get seconds per liquidity inside range



| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 |  |
| topTick | int24 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| innerSecondsSpentPerLiquidity | uint160 |  |

### cross


`function cross(int24 nextTick, bool zeroToOne) external`  external


*Developer note: This function is called by the main pool when an initialized tick is crossed there.
If the tick is also initialized in a virtual pool it should be crossed too*



| Name | Type | Description |
| ---- | ---- | ----------- |
| nextTick | int24 | The crossed tick |
| zeroToOne | bool | The direction |


### increaseCumulative


`function increaseCumulative(uint32 currentTimestamp) external returns (enum IAlgebraVirtualPool.Status)`  external


*Developer note: This function is called from the main pool before every swap To increase seconds per liquidity
cumulative considering previous timestamp and liquidity. The liquidity is stored in a virtual pool*



| Name | Type | Description |
| ---- | ---- | ----------- |
| currentTimestamp | uint32 | The timestamp of the current swap |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | enum IAlgebraVirtualPool.Status | Status The status of virtual pool |

### applyLiquidityDeltaToPosition


`function applyLiquidityDeltaToPosition(uint32 currentTimestamp, int24 bottomTick, int24 topTick, int128 liquidityDelta, int24 currentTick) external`  external


*Developer note: This function is called when anyone farms their liquidity. The position in a virtual pool
should be changed accordingly*



| Name | Type | Description |
| ---- | ---- | ----------- |
| currentTimestamp | uint32 | The timestamp of current block |
| bottomTick | int24 | The bottom tick of a position |
| topTick | int24 | The top tick of a position |
| liquidityDelta | int128 | The amount of liquidity in a position |
| currentTick | int24 | The current tick in the main pool |





