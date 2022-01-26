

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

### uint8 tickSpacing constant

The pool tick spacing

*Developer note: Ticks can only be used at multiples of this value
e.g.: a tickSpacing of 60 means ticks can be initialized every 60th tick, i.e., ..., -120, -60, 0, 60, 120, ...
This value is an int24 to avoid casting even though it is always positive.*
### uint128 maxLiquidityPerTick constant

The maximum amount of position liquidity that can use any tick in the range

*Developer note: This parameter is enforced per tick to prevent liquidity from overflowing a uint128 at any point, and
also prevents out-of-range liquidity from being used to prevent adding in-range liquidity to a pool*



---


