

# AlgebraVirtualPoolBase




## Modifiers
### onlyFromPool



only pool (or FarmingCenter as &quot;proxy&quot;) can call





### onlyFarming











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
### cross

onlyFromPool

`cross(int24,bool)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| nextTick | int24 |  |
| zeroToOne | bool |  |


### increaseCumulative

onlyFromPool

`increaseCumulative(uint32)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| currentTimestamp | uint32 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | enum IAlgebraVirtualPool.Status |  |

### applyLiquidityDeltaToPosition

onlyFarming

`applyLiquidityDeltaToPosition(uint32,int24,int24,int128,int24)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| currentTimestamp | uint32 |  |
| bottomTick | int24 |  |
| topTick | int24 |  |
| liquidityDelta | int128 |  |
| currentTick | int24 |  |




---


