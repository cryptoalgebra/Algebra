

# IncentiveVirtualPool

## Modifiers
### onlyFarmingCenter









### onlyFarming











## Variables
### address farmingCenterAddress immutable



### address farmingAddress immutable



### address pool immutable



### uint32 desiredEndTimestamp immutable



### uint32 desiredStartTimestamp immutable



### uint32 initTimestamp 



### uint32 endTimestamp 



### uint32 timeOutside 



### uint128 prevLiquidity 



### uint128 currentLiquidity 



### uint160 globalSecondsPerLiquidityCumulative 



### uint32 prevTimestamp 



### int24 globalTick 



### mapping(int24 &#x3D;&gt; struct TickManager.Tick) ticks 




## Functions
### constructor


`constructor(address,address,address,uint32,uint32)`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _farmingCenterAddress | address |  |
| _farmingAddress | address |  |
| _pool | address |  |
| _desiredStartTimestamp | uint32 |  |
| _desiredEndTimestamp | uint32 |  |


### finish

onlyFarming

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

### cross

onlyFarmingCenter

`cross(int24,bool)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| nextTick | int24 | The crossed tick |
| zeroForOne | bool | The direction |


### increaseCumulative

onlyFarmingCenter

`increaseCumulative(uint32)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| currentTimestamp | uint32 | The timestamp of the current swap |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | enum IAlgebraVirtualPool.Status |  |

### processSwap

onlyFarmingCenter

`processSwap()`  external







### applyLiquidityDeltaToPosition

onlyFarming

`applyLiquidityDeltaToPosition(int24,int24,int128,int24)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 | The bottom tick of a position |
| topTick | int24 | The top tick of a position |
| liquidityDelta | int128 | The amount of liquidity in a position |
| tick | int24 | The current tick in the main pool |




---


