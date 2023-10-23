

# EternalVirtualPool


Algebra eternal virtual pool

used to track active liquidity in farming and distribute rewards

**Inherits:** Timestamp [VirtualTickStructure](../base/VirtualTickStructure.md)
## Modifiers
### onlyFromFarming

```solidity
modifier onlyFromFarming()
```




## Public variables
### farmingAddress
```solidity
address immutable farmingAddress
```
**Selector**: `0x8a2ade58`

Returns address of the AlgebraEternalFarming


### plugin
```solidity
address immutable plugin
```
**Selector**: `0xef01df4f`

Returns address of the plugin for which this virtual pool was created


### currentLiquidity
```solidity
uint128 currentLiquidity
```
**Selector**: `0x46caf2ae`

Returns the current liquidity in virtual pool


### globalTick
```solidity
int24 globalTick
```
**Selector**: `0x8e76c332`

Returns the current tick in virtual pool


### prevTimestamp
```solidity
uint32 prevTimestamp
```
**Selector**: `0xd576dfc0`

Returns the timestamp after previous virtual pool update


### deactivated
```solidity
bool deactivated
```
**Selector**: `0x556ed30e`

Returns true if virtual pool is deactivated



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
**Selector**: `0xf0de8228`

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
**Selector**: `0xa88a5c16`

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
**Selector**: `0x5e075b53`

Get reward growth accumulators

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardGrowth0 | uint256 | The reward growth for reward0, per unit of liquidity, has only relative meaning |
| rewardGrowth1 | uint256 | The reward growth for reward1, per unit of liquidity, has only relative meaning |

### getInnerRewardsGrowth

```solidity
function getInnerRewardsGrowth(int24 bottomTick, int24 topTick) external view returns (uint256 rewardGrowthInside0, uint256 rewardGrowthInside1)
```
**Selector**: `0x0bd6f200`

Retrieves rewards growth data inside specified range

*Developer note: Should only be used for relative comparison of the same range over time*

| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 | The lower tick boundary of the range |
| topTick | int24 | The upper tick boundary of the range |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardGrowthInside0 | uint256 | The all-time reward growth in token0, per unit of liquidity, inside the range's tick boundaries |
| rewardGrowthInside1 | uint256 | The all-time reward growth in token1, per unit of liquidity, inside the range's tick boundaries |

### deactivate

```solidity
function deactivate() external
```
**Selector**: `0x51b42b00`

This function is used to deactivate virtual pool

*Developer note: Can only be called by farming*

### addRewards

```solidity
function addRewards(uint128 token0Amount, uint128 token1Amount) external
```
**Selector**: `0xfddf08e5`

Top up rewards reserves

| Name | Type | Description |
| ---- | ---- | ----------- |
| token0Amount | uint128 | The amount of token0 |
| token1Amount | uint128 | The amount of token1 |

### decreaseRewards

```solidity
function decreaseRewards(uint128 token0Amount, uint128 token1Amount) external
```
**Selector**: `0xca16ca7e`

Withdraw rewards from reserves directly

| Name | Type | Description |
| ---- | ---- | ----------- |
| token0Amount | uint128 | The amount of token0 |
| token1Amount | uint128 | The amount of token1 |

### crossTo

```solidity
function crossTo(int24 targetTick, bool zeroToOne) external returns (bool)
```
**Selector**: `0x34d33590`



*Developer note: If the virtual pool is deactivated, does nothing*

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
**Selector**: `0x6f4a2cd0`



*Developer note: This function is called by farming to increase rewards per liquidity accumulator.
Can only be called by farming*

### applyLiquidityDeltaToPosition

```solidity
function applyLiquidityDeltaToPosition(int24 bottomTick, int24 topTick, int128 liquidityDelta, int24 currentTick) external
```
**Selector**: `0xd6b83ede`



*Developer note: This function is called when anyone changes their farmed liquidity. The position in a virtual pool should be changed accordingly.
If the virtual pool is deactivated, does nothing.*

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
**Selector**: `0x7f463bb8`

Change reward rates

| Name | Type | Description |
| ---- | ---- | ----------- |
| rate0 | uint128 | The new rate of main token distribution per sec |
| rate1 | uint128 | The new rate of bonus token distribution per sec |

