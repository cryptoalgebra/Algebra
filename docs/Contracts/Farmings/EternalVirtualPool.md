

# EternalVirtualPool


Algebra eternal virtual pool

used to track active liquidity in farming and distribute rewards

## Modifiers
### onlyFromFarming

```solidity
modifier onlyFromFarming()
```




## Variables
### uint128 currentLiquidity 




### int24 globalTick 




### uint32 prevTimestamp 




### bool deactivated 




### address farmingAddress immutable




### address plugin immutable





## Functions
### constructor

```solidity
constructor(address _farmingAddress, address _plugin) public
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| _farmingAddress | address |  |
| _plugin | address |  |

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

### crossTo

```solidity
function crossTo(int24 targetTick, bool zeroToOne) external returns (bool)
```



*Developer note: This function is called by the main pool if an initialized ticks are crossed by swap.
If any one of crossed ticks is also initialized in a virtual pool it should be crossed too*

| Name | Type | Description |
| ---- | ---- | ----------- |
| targetTick | int24 | The target tick up to which we need to cross all active ticks |
| zeroToOne | bool | Swap direction |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

### distributeRewards

```solidity
function distributeRewards() external
```



*Developer note: This function is called from the main pool before every swap To increase rewards per liquidity
cumulative considering previous liquidity. The liquidity is stored in a virtual pool*

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

### setRates

```solidity
function setRates(uint128 rate0, uint128 rate1) external
```

Change reward rates

| Name | Type | Description |
| ---- | ---- | ----------- |
| rate0 | uint128 | The new rate of main token distribution per sec |
| rate1 | uint128 | The new rate of bonus token distribution per sec |

