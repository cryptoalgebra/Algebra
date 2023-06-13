

# PoolImmutables









## Variables
### address dataStorageOperator immutable

The contract that stores all the timepoints and can perform actions with them

### address factory immutable

The contract that deployed the pool, which must adhere to the IAlgebraFactory interface

### address token0 immutable

The first of the two tokens of the pool, sorted by address

### address token1 immutable

The second of the two tokens of the pool, sorted by address


## Functions
### maxLiquidityPerTick


`function maxLiquidityPerTick() external pure returns (uint128)` pure external

The maximum amount of position liquidity that can use any tick in the range
*Developer note: This parameter is enforced per tick to prevent liquidity from overflowing a uint128 at any point, and
also prevents out-of-range liquidity from being used to prevent adding in-range liquidity to a pool*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 | The max amount of liquidity per tick |




