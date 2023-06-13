

# IAlgebraPoolDerivedState


Pool state that is not stored

Contains view functions to provide information about the pool that is computed rather than stored on the
blockchain. The functions here may have variable gas costs.

*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces*




## Functions
### getTimepoints


`function getTimepoints(uint32[] secondsAgos) external view returns (int56[] tickCumulatives, uint160[] secondsPerLiquidityCumulatives, uint112[] volatilityCumulatives, uint256[] volumePerAvgLiquiditys)` view external

Returns the cumulative tick and liquidity as of each timestamp &#x60;secondsAgo&#x60; from the current block timestamp
*Developer note: To get a time weighted average tick or liquidity-in-range, you must call this with two values, one representing
the beginning of the period and another for the end of the period. E.g., to get the last hour time-weighted average tick,
you must call it with secondsAgos &#x3D; [3600, 0].
The time weighted average tick represents the geometric time weighted average price of the pool, in
log base sqrt(1.0001) of token1 / token0. The TickMath library can be used to go from a tick value to a ratio.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| secondsAgos | uint32[] | From how long ago each cumulative tick and liquidity value should be returned |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulatives | int56[] | Cumulative tick values as of each &#x60;secondsAgos&#x60; from the current block timestamp |
| secondsPerLiquidityCumulatives | uint160[] | Cumulative seconds per liquidity-in-range value as of each &#x60;secondsAgos&#x60; from the current block timestamp |
| volatilityCumulatives | uint112[] | Cumulative standard deviation as of each &#x60;secondsAgos&#x60; |
| volumePerAvgLiquiditys | uint256[] | Cumulative swap volume per liquidity as of each &#x60;secondsAgos&#x60; |

### getInnerCumulatives


`function getInnerCumulatives(int24 bottomTick, int24 topTick) external view returns (int56 innerTickCumulative, uint160 innerSecondsSpentPerLiquidity, uint32 innerSecondsSpent)` view external

Returns a snapshot of the tick cumulative, seconds per liquidity and seconds inside a tick range
*Developer note: Snapshots must only be compared to other snapshots, taken over a period for which a position existed.
I.e., snapshots cannot be compared if a position is not held for the entire period between when the first
snapshot is taken and the second snapshot is taken.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 | The lower tick of the range |
| topTick | int24 | The upper tick of the range |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| innerTickCumulative | int56 | The snapshot of the tick accumulator for the range |
| innerSecondsSpentPerLiquidity | uint160 | The snapshot of seconds per liquidity for the range |
| innerSecondsSpent | uint32 | The snapshot of the number of seconds during which the price was in this range |




