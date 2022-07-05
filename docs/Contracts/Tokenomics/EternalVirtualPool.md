

# EternalVirtualPool






## Variables
### uint128 rewardRate0 



### uint128 rewardRate1 



### uint256 rewardReserve0 



### uint256 rewardReserve1 



### uint256 totalRewardGrowth0 



### uint256 totalRewardGrowth1 




## Functions
### constructor

AlgebraVirtualPoolBase

`constructor(address,address,address)`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _farmingCenterAddress | address |  |
| _farmingAddress | address |  |
| _pool | address |  |


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


