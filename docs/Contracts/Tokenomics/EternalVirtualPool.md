

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


`constructor(address _farmingCenterAddress, address _farmingAddress, address _pool) public`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _farmingCenterAddress | address |  |
| _farmingAddress | address |  |
| _pool | address |  |


### rewardReserves


`function rewardReserves() external view returns (uint256 reserve0, uint256 reserve1)` view external

Get reserves of rewards in one call




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reserve0 | uint256 | The reserve of token0 |
| reserve1 | uint256 | The reserve of token1 |

### rewardRates


`function rewardRates() external view returns (uint128 rate0, uint128 rate1)` view external

Get rates of rewards in one call




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| rate0 | uint128 | The rate of token0, rewards / sec |
| rate1 | uint128 | The rate of token1, rewards / sec |

### distributeRewards


`function distributeRewards() external`  external


*Developer note: This function is called from the farming contract to update rewards for users*





### addRewards


`function addRewards(uint256 token0Amount, uint256 token1Amount) external`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| token0Amount | uint256 |  |
| token1Amount | uint256 |  |


### decreaseRewards


`function decreaseRewards(uint256 token0Amount, uint256 token1Amount) external`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| token0Amount | uint256 |  |
| token1Amount | uint256 |  |


### setRates


`function setRates(uint128 rate0, uint128 rate1) external`  external

Change reward rates



| Name | Type | Description |
| ---- | ---- | ----------- |
| rate0 | uint128 | The new rate of main token distribution per sec |
| rate1 | uint128 | The new rate of bonus token distribution per sec |


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




