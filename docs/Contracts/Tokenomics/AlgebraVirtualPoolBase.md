

# AlgebraVirtualPoolBase

Abstract base contract for Algebra virtual pools


## Modifiers
### onlyFromPool



only pool (or FarmingCenter as &quot;proxy&quot;) can call





### onlyFarming











## Variables
### address farmingCenterAddress immutable



### address farmingAddress immutable



### address pool immutable



### mapping(int24 &#x3D;&gt; struct TickManagement.Tick) ticks 



### uint128 currentLiquidity 



### int24 globalTick 



### uint32 timeOutside 



### uint160 globalSecondsPerLiquidityCumulative 



### uint32 prevTimestamp 




## Functions
### getInnerSecondsPerLiquidity


`getInnerSecondsPerLiquidity(int24,int24)` view external

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

onlyFromPool

`cross(int24,bool)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| nextTick | int24 | The crossed tick |
| zeroToOne | bool | The direction |


### increaseCumulative

onlyFromPool

`increaseCumulative(uint32)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| currentTimestamp | uint32 | The timestamp of the current swap |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | enum IAlgebraVirtualPool.Status |  |

### applyLiquidityDeltaToPosition

onlyFarming

`applyLiquidityDeltaToPosition(uint32,int24,int24,int128,int24)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| currentTimestamp | uint32 | The timestamp of current block |
| bottomTick | int24 | The bottom tick of a position |
| topTick | int24 | The top tick of a position |
| liquidityDelta | int128 | The amount of liquidity in a position |
| currentTick | int24 | The current tick in the main pool |




---


