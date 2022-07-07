

# IAlgebraPoolDerivedState

Pool state that is not stored
Contains view functions to provide information about the pool that is computed rather than stored on the
blockchain. The functions here may have variable gas costs.




## Functions
### getTimepoints


`getTimepoints(uint32[])` view external

Returns the cumulative tick and liquidity as of each timestamp &#x60;secondsAgo&#x60; from the current block timestamp



| Name | Type | Description |
| ---- | ---- | ----------- |
| secondsAgos | uint32[] | From how long ago each cumulative tick and liquidity value should be returned |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulatives | int56[] |  |
| secondsPerLiquidityCumulatives | uint160[] |  |
| volatilityCumulatives | uint112[] |  |
| volumePerAvgLiquiditys | uint256[] |  |

### getInnerCumulatives


`getInnerCumulatives(int24,int24)` view external

Returns a snapshot of the tick cumulative, seconds per liquidity and seconds inside a tick range



| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 | The lower tick of the range |
| topTick | int24 | The upper tick of the range |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| innerTickCumulative | int56 |  |
| innerSecondsSpentPerLiquidity | uint160 |  |
| innerSecondsSpent | uint32 |  |



---


