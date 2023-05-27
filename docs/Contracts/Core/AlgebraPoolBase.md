

# AlgebraPoolBase


Algebra pool base abstract contract

Contains state variables, immutables and common internal functions


## Modifiers
### onlyValidTicks


`modifier onlyValidTicks(int24 bottomTick, int24 topTick)`  internal





| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 |  |
| topTick | int24 |  |




## Variables
### address dataStorageOperator immutable

The contract that stores all the timepoints and can perform actions with them

### address factory immutable

The contract that deployed the pool, which must adhere to the IAlgebraFactory interface

### address token0 immutable

The first of the two tokens of the pool, sorted by address

### address token1 immutable

The second of the two tokens of the pool, sorted by address

### address communityVault immutable

The contract to which community fees are transferred

### uint256 totalFeeGrowth0Token 

The fee growth as a Q128.128 fees of token0 collected per unit of liquidity for the entire life of the pool

*Developer note: This value can overflow the uint256*
### uint256 totalFeeGrowth1Token 

The fee growth as a Q128.128 fees of token1 collected per unit of liquidity for the entire life of the pool

*Developer note: This value can overflow the uint256*
### struct AlgebraPoolBase.GlobalState globalState 

The globalState structure in the pool stores many values but requires only one slot
and is exposed as a single method to save gas when accessed externally.

### uint128 liquidity 

The currently in range liquidity available to the pool

*Developer note: This value has no relationship to the total liquidity across all ticks.
Returned value cannot exceed type(uint128).max*
### int24 tickSpacing 

The current tick spacing

*Developer note: Ticks can only be used at multiples of this value
e.g.: a tickSpacing of 60 means ticks can be initialized every 60th tick, i.e., ..., -120, -60, 0, 60, 120, ...
This value is an int24 to avoid casting even though it is always positive.*
### int24 tickSpacingLimitOrders 

The current tick spacing for limit orders

*Developer note: Ticks can only be used for limit orders at multiples of this value
This value is an int24 to avoid casting even though it is always positive.*
### uint32 communityFeeLastTimestamp 

The timestamp of the last sending of tokens to community vault

### uint160 secondsPerLiquidityCumulative 

The accumulator of seconds per liquidity since the pool was first initialized

### address activeIncentive 

Returns the information about active incentive

*Developer note: if there is no active incentive at the moment, incentiveAddress would be equal to address(0)*
### mapping(int24 &#x3D;&gt; struct TickManagement.Tick) ticks 

Look up information about a specific tick in the pool

### mapping(int24 &#x3D;&gt; struct LimitOrderManagement.LimitOrder) limitOrders 

Returns the summary information about a limit orders at tick

### mapping(int16 &#x3D;&gt; uint256) tickTable 

Returns 256 packed tick initialized boolean values. See TickTree for more information


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

### getCommunityFeePending


`function getCommunityFeePending() external view returns (uint128, uint128)` view external

The amounts of token0 and token1 that will be sent to the vault
*Developer note: Will be sent COMMUNITY_FEE_TRANSFER_FREQUENCY after communityFeeLastTimestamp*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 |  |
| [1] | uint128 |  |




