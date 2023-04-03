

# PoolState




## Modifiers
### lock











## Variables
### uint256 totalFeeGrowth0Token 

The fee growth as a Q128.128 fees of token0 collected per unit of liquidity for the entire life of the pool

*Developer note: This value can overflow the uint256*
### uint256 totalFeeGrowth1Token 

The fee growth as a Q128.128 fees of token1 collected per unit of liquidity for the entire life of the pool

*Developer note: This value can overflow the uint256*
### struct PoolState.GlobalState globalState 

The globalState structure in the pool stores many values but requires only one slot
and is exposed as a single method to save gas when accessed externally.

### uint128 liquidity 

The currently in range liquidity available to the pool

*Developer note: This value has no relationship to the total liquidity across all ticks.
Returned value cannot exceed type(uint128).max*
### uint32 liquidityCooldown 

Returns the lock time for added liquidity

### address activeIncentive 

Returns the information about active incentive

*Developer note: if there is no active incentive at the moment, virtualPool,endTimestamp,startTimestamp would be equal to 0*
### mapping(int24 &#x3D;&gt; struct TickManagement.Tick) ticks 

Look up information about a specific tick in the pool

### mapping(int16 &#x3D;&gt; uint256) tickTable 

Returns 256 packed tick initialized boolean values. See TickTable for more information




---


