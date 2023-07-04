

# IAlgebraPoolState


Pool state that can change



*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces*




## Functions
### globalState


`function globalState() external view returns (uint160 price, int24 tick, uint16 fee, uint16 timepointIndex, uint8 communityFeeToken0, uint8 communityFeeToken1, bool unlocked)` view external

The globalState structure in the pool stores many values but requires only one slot
and is exposed as a single method to save gas when accessed externally.




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| price | uint160 | The current price of the pool as a sqrt(token1/token0) Q64.96 value; Returns tick The current tick of the pool, i.e. according to the last tick transition that was run; Returns This value may not always be equal to SqrtTickMath.getTickAtSqrtRatio(price) if the price is on a tick boundary; Returns fee The last pool fee value in hundredths of a bip, i.e. 1e-6; Returns timepointIndex The index of the last written timepoint; Returns communityFeeToken0 The community fee percentage of the swap fee in thousandths (1e-3) for token0; Returns communityFeeToken1 The community fee percentage of the swap fee in thousandths (1e-3) for token1; Returns unlocked Whether the pool is currently locked to reentrancy; |
| tick | int24 |  |
| fee | uint16 |  |
| timepointIndex | uint16 |  |
| communityFeeToken0 | uint8 |  |
| communityFeeToken1 | uint8 |  |
| unlocked | bool |  |

### totalFeeGrowth0Token


`function totalFeeGrowth0Token() external view returns (uint256)` view external

The fee growth as a Q128.128 fees of token0 collected per unit of liquidity for the entire life of the pool
*Developer note: This value can overflow the uint256*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### totalFeeGrowth1Token


`function totalFeeGrowth1Token() external view returns (uint256)` view external

The fee growth as a Q128.128 fees of token1 collected per unit of liquidity for the entire life of the pool
*Developer note: This value can overflow the uint256*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### liquidity


`function liquidity() external view returns (uint128)` view external

The currently in range liquidity available to the pool
*Developer note: This value has no relationship to the total liquidity across all ticks.
Returned value cannot exceed type(uint128).max*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 |  |

### ticks


`function ticks(int24 tick) external view returns (uint128 liquidityTotal, int128 liquidityDelta, uint256 outerFeeGrowth0Token, uint256 outerFeeGrowth1Token, int56 outerTickCumulative, uint160 outerSecondsPerLiquidity, uint32 outerSecondsSpent, bool initialized)` view external

Look up information about a specific tick in the pool
*Developer note: This is a public structure, so the &#x60;return&#x60; natspec tags are omitted.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| tick | int24 | The tick to look up |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidityTotal | uint128 | the total amount of position liquidity that uses the pool either as tick lower or tick upper; Returns liquidityDelta how much liquidity changes when the pool price crosses the tick; Returns outerFeeGrowth0Token the fee growth on the other side of the tick from the current tick in token0; Returns outerFeeGrowth1Token the fee growth on the other side of the tick from the current tick in token1; Returns outerTickCumulative the cumulative tick value on the other side of the tick from the current tick; Returns outerSecondsPerLiquidity the seconds spent per liquidity on the other side of the tick from the current tick; Returns outerSecondsSpent the seconds spent on the other side of the tick from the current tick; Returns initialized Set to true if the tick is initialized, i.e. liquidityTotal is greater than 0 otherwise equal to false. Outside values can only be used if the tick is initialized. In addition, these values are only relative and must be used only in comparison to previous snapshots for a specific position. |
| liquidityDelta | int128 |  |
| outerFeeGrowth0Token | uint256 |  |
| outerFeeGrowth1Token | uint256 |  |
| outerTickCumulative | int56 |  |
| outerSecondsPerLiquidity | uint160 |  |
| outerSecondsSpent | uint32 |  |
| initialized | bool |  |

### tickTable


`function tickTable(int16 wordPosition) external view returns (uint256)` view external

Returns 256 packed tick initialized boolean values. See TickTable for more information



| Name | Type | Description |
| ---- | ---- | ----------- |
| wordPosition | int16 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### positions


`function positions(bytes32 key) external view returns (uint128 liquidityAmount, uint32 lastLiquidityAddTimestamp, uint256 innerFeeGrowth0Token, uint256 innerFeeGrowth1Token, uint128 fees0, uint128 fees1)` view external

Returns the information about a position by the position&#x27;s key
*Developer note: This is a public mapping of structures, so the &#x60;return&#x60; natspec tags are omitted.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | bytes32 | The position&#x27;s key is a hash of a preimage composed by the owner, bottomTick and topTick |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidityAmount | uint128 | The amount of liquidity in the position; Returns lastLiquidityAddTimestamp Timestamp of last adding of liquidity; Returns innerFeeGrowth0Token Fee growth of token0 inside the tick range as of the last mint/burn/poke; Returns innerFeeGrowth1Token Fee growth of token1 inside the tick range as of the last mint/burn/poke; Returns fees0 The computed amount of token0 owed to the position as of the last mint/burn/poke; Returns fees1 The computed amount of token1 owed to the position as of the last mint/burn/poke |
| lastLiquidityAddTimestamp | uint32 |  |
| innerFeeGrowth0Token | uint256 |  |
| innerFeeGrowth1Token | uint256 |  |
| fees0 | uint128 |  |
| fees1 | uint128 |  |

### timepoints


`function timepoints(uint256 index) external view returns (bool initialized, uint32 blockTimestamp, int56 tickCumulative, uint160 secondsPerLiquidityCumulative, uint88 volatilityCumulative, int24 averageTick, uint144 volumePerLiquidityCumulative)` view external

Returns data about a specific timepoint index
*Developer note: You most likely want to use #getTimepoints() instead of this method to get an timepoint as of some amount of time
ago, rather than at a specific index in the array.
This is a public mapping of structures, so the &#x60;return&#x60; natspec tags are omitted.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint256 | The element of the timepoints array to fetch |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| initialized | bool | whether the timepoint has been initialized and the values are safe to use; Returns blockTimestamp The timestamp of the timepoint; Returns tickCumulative the tick multiplied by seconds elapsed for the life of the pool as of the timepoint timestamp; Returns secondsPerLiquidityCumulative the seconds per in range liquidity for the life of the pool as of the timepoint timestamp; Returns volatilityCumulative Cumulative standard deviation for the life of the pool as of the timepoint timestamp; Returns averageTick Time-weighted average tick; Returns volumePerLiquidityCumulative Cumulative swap volume per liquidity for the life of the pool as of the timepoint timestamp; |
| blockTimestamp | uint32 |  |
| tickCumulative | int56 |  |
| secondsPerLiquidityCumulative | uint160 |  |
| volatilityCumulative | uint88 |  |
| averageTick | int24 |  |
| volumePerLiquidityCumulative | uint144 |  |

### activeIncentive


`function activeIncentive() external view returns (address virtualPool)` view external

Returns the information about active incentive
*Developer note: if there is no active incentive at the moment, virtualPool,endTimestamp,startTimestamp would be equal to 0*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPool | address | The address of a virtual pool associated with the current active incentive |

### liquidityCooldown


`function liquidityCooldown() external view returns (uint32 cooldownInSeconds)` view external

Returns the lock time for added liquidity




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| cooldownInSeconds | uint32 |  |

### tickSpacing


`function tickSpacing() external view returns (int24)` view external

The pool tick spacing
*Developer note: Ticks can only be used at multiples of this value
e.g.: a tickSpacing of 60 means ticks can be initialized every 60th tick, i.e., ..., -120, -60, 0, 60, 120, ...
This value is an int24 to avoid casting even though it is always positive.*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | int24 | The tick spacing |




