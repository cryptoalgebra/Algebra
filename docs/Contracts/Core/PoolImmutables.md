

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
### tickSpacing


`tickSpacing()` pure external

The pool tick spacing




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | int24 |  |

### maxLiquidityPerTick


`maxLiquidityPerTick()` pure external

The maximum amount of position liquidity that can use any tick in the range




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 |  |



---


