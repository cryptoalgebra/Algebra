

# EternalVirtualPool

## Modifiers
### onlyFarmingCenter









### onlyFarming











## Variables
### address farmingCenterAddress immutable



### address farmingAddress immutable



### uint32 timeOutside 



### uint160 globalSecondsPerLiquidityCumulative 



### uint128 prevLiquidity 



### uint128 currentLiquidity 



### uint32 prevTimestamp 



### int24 globalTick 



### mapping(int24 &#x3D;&gt; struct TickManager.Tick) ticks 



### uint128 rewardRate0 



### uint128 rewardRate1 



### uint256 rewardReserve0 



### uint256 rewardReserve1 



### uint256 totalRewardGrowth0 



### uint256 totalRewardGrowth1 




## Functions
### constructor


`constructor(address,address)`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _farmingCenterAddress | address |  |
| _farmingAddress | address |  |


### addRewards

onlyFarming

`addRewards(uint256,uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| token0Amount | uint256 |  |
| token1Amount | uint256 |  |


### setRates

onlyFarming

`setRates(uint128,uint128)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| rate0 | uint128 |  |
| rate1 | uint128 |  |


### getInnerSecondsPerLiquidity


`getInnerSecondsPerLiquidity(int24,int24)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 |  |
| topTick | int24 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| innerSecondsSpentPerLiquidity | uint160 |  |

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

### cross

onlyFarmingCenter

`cross(int24,bool)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| nextTick | int24 |  |
| zeroForOne | bool |  |


### increaseCumulative

onlyFarmingCenter

`increaseCumulative(uint32)`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| currentTimestamp | uint32 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | enum IAlgebraVirtualPool.Status |  |

### processSwap

onlyFarmingCenter

`processSwap()`  external







### applyLiquidityDeltaToPosition

onlyFarming

`applyLiquidityDeltaToPosition(uint32,int24,int24,int128,int24)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| currentTimestamp | uint32 |  |
| bottomTick | int24 |  |
| topTick | int24 |  |
| liquidityDelta | int128 |  |
| tick | int24 |  |




---


