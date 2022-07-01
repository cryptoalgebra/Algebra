

# IAlgebraEternalVirtualPool







## Functions
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

### getInnerSecondsPerLiquidity


`getInnerSecondsPerLiquidity(int24,int24)` view external

This function is used to calculate the seconds per liquidity inside a certain position



| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 | The bottom tick of a position |
| topTick | int24 | The top tick of a position |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| innerSecondsSpentPerLiquidity | uint160 |  |



---


