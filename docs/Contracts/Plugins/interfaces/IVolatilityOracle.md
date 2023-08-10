

# IVolatilityOracle


The interface for the Algebra volatility oracle



*Developer note: This contract stores timepoints and calculates statistical averages*


## Functions
### timepoints


```solidity
function timepoints(uint256 index) external view returns (bool initialized, uint32 blockTimestamp, int56 tickCumulative, uint88 volatilityCumulative, int24 tick, int24 averageTick, uint16 windowStartIndex)
```

Returns data belonging to a certain timepoint

*Developer note: There is more convenient function to fetch a timepoint: getTimepoints(). Which requires not an index but seconds*

| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint256 | The index of timepoint in the array |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| initialized | bool | Whether the timepoint has been initialized and the values are safe to use |
| blockTimestamp | uint32 | The timestamp of the timepoint |
| tickCumulative | int56 | The tick multiplied by seconds elapsed for the life of the pool as of the timepoint timestamp |
| volatilityCumulative | uint88 | Cumulative standard deviation for the life of the pool as of the timepoint timestamp |
| tick | int24 | The tick at blockTimestamp |
| averageTick | int24 | Time-weighted average tick |
| windowStartIndex | uint16 | Index of closest timepoint >= WINDOW seconds ago |

### timepointIndex


```solidity
function timepointIndex() external view returns (uint16)
```



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint16 |  |

### getSingleTimepoint


```solidity
function getSingleTimepoint(uint32 secondsAgo) external view returns (int56 tickCumulative, uint112 volatilityCumulative)
```



*Developer note: Reverts if a timepoint at or before the desired timepoint timestamp does not exist.
0 may be passed as &#x60;secondsAgo&#x27; to return the current cumulative values.
If called with a timestamp falling between two timepoints, returns the counterfactual accumulator values
at exactly the timestamp between the two timepoints.*

| Name | Type | Description |
| ---- | ---- | ----------- |
| secondsAgo | uint32 | The amount of time to look back, in seconds, at which point to return a timepoint |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulative | int56 | The cumulative tick since the pool was first initialized, as of `secondsAgo` |
| volatilityCumulative | uint112 | The cumulative volatility value since the pool was first initialized, as of `secondsAgo` |

### getTimepoints


```solidity
function getTimepoints(uint32[] secondsAgos) external view returns (int56[] tickCumulatives, uint112[] volatilityCumulatives)
```

Returns the accumulator values as of each time seconds ago from the given time in the array of &#x60;secondsAgos&#x60;

*Developer note: Reverts if &#x60;secondsAgos&#x60; &gt; oldest timepoint*

| Name | Type | Description |
| ---- | ---- | ----------- |
| secondsAgos | uint32[] | Each amount of time to look back, in seconds, at which point to return a timepoint |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulatives | int56[] | The cumulative tick since the pool was first initialized, as of each `secondsAgo` |
| volatilityCumulatives | uint112[] | The cumulative volatility values since the pool was first initialized, as of each `secondsAgo` |

### prepayTimepointsStorageSlots


```solidity
function prepayTimepointsStorageSlots(uint16 startIndex, uint16 amount) external
```

Fills uninitialized timepoints with nonzero value

*Developer note: Can be used to reduce the gas cost of future swaps*

| Name | Type | Description |
| ---- | ---- | ----------- |
| startIndex | uint16 | The start index, must be not initialized |
| amount | uint16 | of slots to fill, startIndex + amount must be <= type(uint16).max |

