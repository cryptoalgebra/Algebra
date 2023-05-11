

# EternalVirtualPool

Algebra eternal virtual pool
used to track active liquidity in farming and distribute rewards

## Modifiers
# onlyFromFarming


`modifier onlyFromFarming()`  internal









## Variables
# address farmingAddress immutable



# address pool immutable



# uint128 currentLiquidity 



# int24 globalTick 



# uint32 prevTimestamp 



# uint256 totalRewardGrowth0 



# uint256 totalRewardGrowth1 




## Functions
# constructor


`constructor(address _farmingAddress, address _pool) public`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _farmingAddress | address |  |
| _pool | address |  |


# rewardReserves


`function rewardReserves() external view returns (uint128 reserve0, uint128 reserve1)` view external

Get reserves of rewards in one call




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reserve0 | uint128 | The reserve of token0 |
| reserve1 | uint128 | The reserve of token1 |

# rewardRates


`function rewardRates() external view returns (uint128 rate0, uint128 rate1)` view external

Get rates of rewards in one call




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| rate0 | uint128 | The rate of token0, rewards / sec |
| rate1 | uint128 | The rate of token1, rewards / sec |

# getInnerRewardsGrowth


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

# addRewards


`function addRewards(uint128 token0Amount, uint128 token1Amount) external`  external

Top up rewards reserves



| Name | Type | Description |
| ---- | ---- | ----------- |
| token0Amount | uint128 | The amount of token0 |
| token1Amount | uint128 | The amount of token1 |


# decreaseRewards


`function decreaseRewards(uint128 token0Amount, uint128 token1Amount) external`  external

Withdraw rewards from reserves directly



| Name | Type | Description |
| ---- | ---- | ----------- |
| token0Amount | uint128 | The amount of token0 |
| token1Amount | uint128 | The amount of token1 |


# crossTo


`function crossTo(int24 targetTick, bool zeroToOne) external returns (bool)`  external


*Developer note: This function is called by the main pool if an initialized ticks are crossed by swap.
If any one of crossed ticks is also initialized in a virtual pool it should be crossed too*



| Name | Type | Description |
| ---- | ---- | ----------- |
| targetTick | int24 | The target tick up to which we need to cross all active ticks |
| zeroToOne | bool | The direction |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

# distributeRewards


`function distributeRewards() external`  external


*Developer note: This function is called from the main pool before every swap To increase rewards per liquidity
cumulative considering previous liquidity. The liquidity is stored in a virtual pool*





# applyLiquidityDeltaToPosition


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


# setRates


`function setRates(uint128 rate0, uint128 rate1) external`  external

Change reward rates



| Name | Type | Description |
| ---- | ---- | ----------- |
| rate0 | uint128 | The new rate of main token distribution per sec |
| rate1 | uint128 | The new rate of bonus token distribution per sec |




---


