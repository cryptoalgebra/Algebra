

# DerivedState


Pool state that is not stored
Contains view functions to provide information about the pool that is computed rather than stored on the blockchain




## Functions
### getInnerCumulatives


`function getInnerCumulatives(int24 bottomTick, int24 topTick) external view returns (uint160 innerSecondsSpentPerLiquidity, uint32 innerSecondsSpent)` view external

Returns a snapshot of seconds per liquidity and seconds inside a tick range
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
| innerSecondsSpentPerLiquidity | uint160 | The snapshot of seconds per liquidity for the range |
| innerSecondsSpent | uint32 | The snapshot of the number of seconds during which the price was in this range |





---

