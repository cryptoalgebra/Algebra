

# IAlgebraEternalVirtualPool








## Functions
### ticks


`function ticks(int24 tickId) external view returns (uint128 liquidityTotal, int128 liquidityDelta, uint256 outerFeeGrowth0Token, uint256 outerFeeGrowth1Token, int24 prevTick, int24 nextTick)` view external





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
| prevTick | int24 |  |
| nextTick | int24 |  |

### currentLiquidity


`function currentLiquidity() external view returns (uint128)` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 |  |

### globalTick


`function globalTick() external view returns (int24)` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | int24 |  |

### prevTimestamp


`function prevTimestamp() external view returns (uint32)` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

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


### distributeRewards


`function distributeRewards() external`  external


*Developer note: This function is called from the main pool before every swap To increase rewards per liquidity
cumulative considering previous liquidity. The liquidity is stored in a virtual pool*





### setRates


`function setRates(uint128 rate0, uint128 rate1) external`  external

Change reward rates



| Name | Type | Description |
| ---- | ---- | ----------- |
| rate0 | uint128 | The new rate of main token distribution per sec |
| rate1 | uint128 | The new rate of bonus token distribution per sec |


### addRewards


`function addRewards(uint128 token0Amount, uint128 token1Amount) external`  external

Top up rewards reserves



| Name | Type | Description |
| ---- | ---- | ----------- |
| token0Amount | uint128 | The amount of token0 |
| token1Amount | uint128 | The amount of token1 |


### decreaseRewards


`function decreaseRewards(uint128 token0Amount, uint128 token1Amount) external`  external

Withdraw rewards from reserves directly



| Name | Type | Description |
| ---- | ---- | ----------- |
| token0Amount | uint128 | The amount of token0 |
| token1Amount | uint128 | The amount of token1 |


### getInnerRewardsGrowth


`function getInnerRewardsGrowth(int24 bottomTick, int24 topTick) external view returns (uint256 rewardGrowthInside0, uint256 rewardGrowthInside1)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 |  |
| topTick | int24 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardGrowthInside0 | uint256 |  |
| rewardGrowthInside1 | uint256 |  |

### rewardReserves


`function rewardReserves() external view returns (uint128 reserve0, uint128 reserve1)` view external

Get reserves of rewards in one call




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reserve0 | uint128 | The reserve of token0 |
| reserve1 | uint128 | The reserve of token1 |

### rewardRates


`function rewardRates() external view returns (uint128 rate0, uint128 rate1)` view external

Get rates of rewards in one call




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| rate0 | uint128 | The rate of token0, rewards / sec |
| rate1 | uint128 | The rate of token1, rewards / sec |




## Errors
## onlyPool


`error onlyPool()`  







## onlyFarming


`error onlyFarming()`  








---

