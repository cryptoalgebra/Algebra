

# IAlgebraPoolState

Pool state that can change

*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces*




## Functions
# globalState


`function globalState() external view returns (uint160 price, int24 tick, int24 prevInitializedTick, uint16 fee, uint16 timepointIndex, uint8 communityFee, bool unlocked)` view external

The globalState structure in the pool stores many values but requires only one slot
and is exposed as a single method to save gas when accessed externally.




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| price | uint160 | The current price of the pool as a sqrt(dToken1/dToken0) Q64.96 value; |
| tick | int24 | The current tick of the pool, i.e. according to the last tick transition that was run; This value may not always be equal to SqrtTickMath.getTickAtSqrtRatio(price) if the price is on a tick boundary; |
| prevInitializedTick | int24 | The previous initialized tick |
| fee | uint16 | The last pool fee value in hundredths of a bip, i.e. 1e-6 |
| timepointIndex | uint16 | The index of the last written timepoint |
| communityFee | uint8 | The community fee percentage of the swap fee in thousandths (1e-3) |
| unlocked | bool | Whether the pool is currently locked to reentrancy |

# totalFeeGrowth0Token


`function totalFeeGrowth0Token() external view returns (uint256)` view external

The fee growth as a Q128.128 fees of token0 collected per unit of liquidity for the entire life of the pool
*Developer note: This value can overflow the uint256*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

# totalFeeGrowth1Token


`function totalFeeGrowth1Token() external view returns (uint256)` view external

The fee growth as a Q128.128 fees of token1 collected per unit of liquidity for the entire life of the pool
*Developer note: This value can overflow the uint256*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

# liquidity


`function liquidity() external view returns (uint128)` view external

The currently in range liquidity available to the pool
*Developer note: This value has no relationship to the total liquidity across all ticks.
Returned value cannot exceed type(uint128).max*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 |  |

# tickSpacing


`function tickSpacing() external view returns (int24)` view external

The current tick spacing
*Developer note: Ticks can only be used at multiples of this value
e.g.: a tickSpacing of 60 means ticks can be initialized every 60th tick, i.e., ..., -120, -60, 0, 60, 120, ...
This value is an int24 to avoid casting even though it is always positive.*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | int24 | The current tick spacing |

# tickSpacingLimitOrders


`function tickSpacingLimitOrders() external view returns (int24)` view external

The current tick spacing for limit orders
*Developer note: Ticks can only be used for limit orders at multiples of this value
This value is an int24 to avoid casting even though it is always positive.*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | int24 | The current tick spacing for limit orders |

# communityFeeLastTimestamp


`function communityFeeLastTimestamp() external view returns (uint32)` view external

The timestamp of the last sending of tokens to community vault




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

# getCommunityFeePending


`function getCommunityFeePending() external view returns (uint128 communityFeePending0, uint128 communityFeePending1)` view external

The amounts of token0 and token1 that will be sent to the vault
*Developer note: Will be sent COMMUNITY_FEE_TRANSFER_FREQUENCY after communityFeeLastTimestamp*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| communityFeePending0 | uint128 |  |
| communityFeePending1 | uint128 |  |

# getReserves


`function getReserves() external view returns (uint128 reserve0, uint128 reserve1)` view external

The tracked token0 and token1 reserves of pool
*Developer note: If at any time the real balance is larger, the excess will be transferred to liquidity providers as additional fee.
If the balance exceeds uint128, the excess will be sent to the communityVault.*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reserve0 | uint128 |  |
| reserve1 | uint128 |  |

# secondsPerLiquidityCumulative


`function secondsPerLiquidityCumulative() external view returns (uint160)` view external

The accumulator of seconds per liquidity since the pool was first initialized




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint160 |  |

# ticks


`function ticks(int24 tick) external view returns (uint128 liquidityTotal, int128 liquidityDelta, uint256 outerFeeGrowth0Token, uint256 outerFeeGrowth1Token, int24 prevTick, int24 nextTick, uint160 outerSecondsPerLiquidity, uint32 outerSecondsSpent, bool hasLimitOrders)` view external

Look up information about a specific tick in the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| tick | int24 | The tick to look up |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidityTotal | uint128 | The total amount of position liquidity that uses the pool either as tick lower or tick upper |
| liquidityDelta | int128 | How much liquidity changes when the pool price crosses the tick |
| outerFeeGrowth0Token | uint256 | The fee growth on the other side of the tick from the current tick in token0 |
| outerFeeGrowth1Token | uint256 | The fee growth on the other side of the tick from the current tick in token1 |
| prevTick | int24 | The previous tick in tick list |
| nextTick | int24 | The next tick in tick list |
| outerSecondsPerLiquidity | uint160 | The seconds spent per liquidity on the other side of the tick from the current tick |
| outerSecondsSpent | uint32 | The seconds spent on the other side of the tick from the current tick |
| hasLimitOrders | bool | Whether there are limit orders on this tick or not In addition, these values are only relative and must be used only in comparison to previous snapshots for a specific position. |

# limitOrders


`function limitOrders(int24 tick) external view returns (uint128 amountToSell, uint128 soldAmount, uint256 boughtAmount0Cumulative, uint256 boughtAmount1Cumulative, bool initialized)` view external

Returns the summary information about a limit orders at tick



| Name | Type | Description |
| ---- | ---- | ----------- |
| tick | int24 | The tick to look up |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountToSell | uint128 | The amount of tokens to sell. Has only relative meaning |
| soldAmount | uint128 | The amount of tokens already sold. Has only relative meaning |
| boughtAmount0Cumulative | uint256 | The accumulator of bought tokens0 per amountToSell. Has only relative meaning |
| boughtAmount1Cumulative | uint256 | The accumulator of bought tokens1 per amountToSell. Has only relative meaning |
| initialized | bool | Will be true if a limit order was created at least once on this tick |

# tickTable


`function tickTable(int16 wordPosition) external view returns (uint256)` view external

Returns 256 packed tick initialized boolean values. See TickTree for more information



| Name | Type | Description |
| ---- | ---- | ----------- |
| wordPosition | int16 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

# positions


`function positions(bytes32 key) external view returns (uint256 liquidity, uint256 innerFeeGrowth0Token, uint256 innerFeeGrowth1Token, uint128 fees0, uint128 fees1)` view external

Returns the information about a position by the position&#x27;s key



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | bytes32 | The position&#x27;s key is a hash of a preimage composed by the owner, bottomTick and topTick |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidity | uint256 | The amount of liquidity in the position |
| innerFeeGrowth0Token | uint256 | Fee growth of token0 inside the tick range as of the last mint/burn/poke |
| innerFeeGrowth1Token | uint256 | Fee growth of token1 inside the tick range as of the last mint/burn/poke |
| fees0 | uint128 | The computed amount of token0 owed to the position as of the last mint/burn/poke |
| fees1 | uint128 | The computed amount of token1 owed to the position as of the last mint/burn/poke |

# activeIncentive


`function activeIncentive() external view returns (address incentiveAddress)` view external

Returns the information about active incentive
*Developer note: if there is no active incentive at the moment, incentiveAddress would be equal to address(0)*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| incentiveAddress | address | The address associated with the current active incentive |



---


