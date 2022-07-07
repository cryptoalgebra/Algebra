

# IAlgebraEternalVirtualPool







## Functions
### setRates


`setRates(uint128,uint128)`  external

Change reward rates



| Name | Type | Description |
| ---- | ---- | ----------- |
| rate0 | uint128 | The new rate of main token distribution per sec |
| rate1 | uint128 | The new rate of bonus token distribution per sec |


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



---


