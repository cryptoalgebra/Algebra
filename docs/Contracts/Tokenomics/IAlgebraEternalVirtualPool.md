

# IAlgebraEternalVirtualPool










## Functions
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

### setRates


`function setRates(uint128 rate0, uint128 rate1) external`  external

Change reward rates



| Name | Type | Description |
| ---- | ---- | ----------- |
| rate0 | uint128 | The new rate of main token distribution per sec |
| rate1 | uint128 | The new rate of bonus token distribution per sec |


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

### rewardRate0


`function rewardRate0() external returns (uint128)`  external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 |  |

### rewardRate1


`function rewardRate1() external returns (uint128)`  external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 |  |

### rewardReserve0


`function rewardReserve0() external returns (uint256)`  external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### rewardReserve1


`function rewardReserve1() external returns (uint256)`  external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |




