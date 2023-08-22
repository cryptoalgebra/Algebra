

# IAlgebraEternalVirtualPool







## Functions
### ticks

```solidity
function ticks(int24 tickId) external view returns (uint256 liquidityTotal, int128 liquidityDelta, int24 prevTick, int24 nextTick, uint256 outerFeeGrowth0Token, uint256 outerFeeGrowth1Token)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| tickId | int24 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidityTotal | uint256 |  |
| liquidityDelta | int128 |  |
| prevTick | int24 |  |
| nextTick | int24 |  |
| outerFeeGrowth0Token | uint256 |  |
| outerFeeGrowth1Token | uint256 |  |

### currentLiquidity

```solidity
function currentLiquidity() external view returns (uint128)
```



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 |  |

### globalTick

```solidity
function globalTick() external view returns (int24)
```



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | int24 |  |

### prevTimestamp

```solidity
function prevTimestamp() external view returns (uint32)
```



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

### deactivated

```solidity
function deactivated() external view returns (bool)
```



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

### applyLiquidityDeltaToPosition

```solidity
function applyLiquidityDeltaToPosition(int24 bottomTick, int24 topTick, int128 liquidityDelta, int24 currentTick) external
```



*Developer note: This function is called when anyone farms their liquidity. The position in a virtual pool
should be changed accordingly*

| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 | The bottom tick of a position |
| topTick | int24 | The top tick of a position |
| liquidityDelta | int128 | The amount of liquidity in a position |
| currentTick | int24 | The current tick in the main pool |

### distributeRewards

```solidity
function distributeRewards() external
```



*Developer note: This function is called from the main pool before every swap To increase rewards per liquidity
cumulative considering previous liquidity. The liquidity is stored in a virtual pool*

### setRates

```solidity
function setRates(uint128 rate0, uint128 rate1) external
```

Change reward rates

| Name | Type | Description |
| ---- | ---- | ----------- |
| rate0 | uint128 | The new rate of main token distribution per sec |
| rate1 | uint128 | The new rate of bonus token distribution per sec |

### deactivate

```solidity
function deactivate() external
```

This function is used to deactivate virtual pool

### addRewards

```solidity
function addRewards(uint128 token0Amount, uint128 token1Amount) external
```

Top up rewards reserves

| Name | Type | Description |
| ---- | ---- | ----------- |
| token0Amount | uint128 | The amount of token0 |
| token1Amount | uint128 | The amount of token1 |

### decreaseRewards

```solidity
function decreaseRewards(uint128 token0Amount, uint128 token1Amount) external
```

Withdraw rewards from reserves directly

| Name | Type | Description |
| ---- | ---- | ----------- |
| token0Amount | uint128 | The amount of token0 |
| token1Amount | uint128 | The amount of token1 |

### getInnerRewardsGrowth

```solidity
function getInnerRewardsGrowth(int24 bottomTick, int24 topTick) external view returns (uint256 rewardGrowthInside0, uint256 rewardGrowthInside1)
```



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

```solidity
function rewardReserves() external view returns (uint128 reserve0, uint128 reserve1)
```

Get reserves of rewards in one call

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reserve0 | uint128 | The reserve of token0 |
| reserve1 | uint128 | The reserve of token1 |

### rewardRates

```solidity
function rewardRates() external view returns (uint128 rate0, uint128 rate1)
```

Get rates of rewards in one call

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| rate0 | uint128 | The rate of token0, rewards / sec |
| rate1 | uint128 | The rate of token1, rewards / sec |

### totalRewardGrowth

```solidity
function totalRewardGrowth() external view returns (uint256 rewardGrowth0, uint256 rewardGrowth1)
```

Get reward growth accumulators

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardGrowth0 | uint256 | The reward growth for reward0, has only relative meaning |
| rewardGrowth1 | uint256 | The reward growth for reward1, has only relative meaning |


## Errors
## onlyPlugin

```solidity
error onlyPlugin()
```



## onlyFarming

```solidity
error onlyFarming()
```



