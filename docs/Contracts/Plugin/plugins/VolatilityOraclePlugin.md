

# VolatilityOraclePlugin


Algebra Integral 1.2.1 VolatilityOraclePlugin plugin

This contract stores timepoints and calculates adaptive fee and statistical averages

**Inherits:** AlgebraBasePlugin [IVolatilityOracle](../interfaces/plugins/IVolatilityOracle.md)

## Public variables
### timepoints
```solidity
struct VolatilityOracle.Timepoint[65536] timepoints
```
**Selector**: `0x74eceae6`

Returns data belonging to a certain timepoint

*Developer note: There is more convenient function to fetch a timepoint: getTimepoints(). Which requires not an index but seconds*

### timepointIndex
```solidity
uint16 timepointIndex
```
**Selector**: `0x0786feb6`

Returns the index of the last timepoint that was written.


### lastTimepointTimestamp
```solidity
uint32 lastTimepointTimestamp
```
**Selector**: `0xf5985d35`

Returns the timestamp of the last timepoint that was written.


### isInitialized
```solidity
bool isInitialized
```
**Selector**: `0x392e53cd`

Returns information about whether oracle is initialized



## Functions
### initialize

```solidity
function initialize() external
```
**Selector**: `0x8129fc1c`

Initialize the plugin externally

*Developer note: This function allows to initialize the plugin if it was created after the pool was created*

### getSingleTimepoint

```solidity
function getSingleTimepoint(uint32 secondsAgo) external view returns (int56 tickCumulative, uint88 volatilityCumulative)
```
**Selector**: `0x88f2e862`



*Developer note: Reverts if a timepoint at or before the desired timepoint timestamp does not exist.
0 may be passed as &#x60;secondsAgo&#x27; to return the current cumulative values.
If called with a timestamp falling between two timepoints, returns the counterfactual accumulator values
at exactly the timestamp between the two timepoints.
&#x60;volatilityCumulative&#x60; values for timestamps after the last timepoint _should not_ be compared because they may differ due to interpolation errors*

| Name | Type | Description |
| ---- | ---- | ----------- |
| secondsAgo | uint32 | The amount of time to look back, in seconds, at which point to return a timepoint |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulative | int56 | The cumulative tick since the pool was first initialized, as of `secondsAgo` |
| volatilityCumulative | uint88 | The cumulative volatility value since the pool was first initialized, as of `secondsAgo` |

### getTimepoints

```solidity
function getTimepoints(uint32[] secondsAgos) external view returns (int56[] tickCumulatives, uint88[] volatilityCumulatives)
```
**Selector**: `0x9d3a5241`

Returns the accumulator values as of each time seconds ago from the given time in the array of &#x60;secondsAgos&#x60;

*Developer note: Reverts if &#x60;secondsAgos&#x60; &gt; oldest timepoint
&#x60;volatilityCumulative&#x60; values for timestamps after the last timepoint _should not_ be compared because they may differ due to interpolation errors*

| Name | Type | Description |
| ---- | ---- | ----------- |
| secondsAgos | uint32[] | Each amount of time to look back, in seconds, at which point to return a timepoint |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulatives | int56[] | The cumulative tick since the pool was first initialized, as of each `secondsAgo` |
| volatilityCumulatives | uint88[] | The cumulative volatility values since the pool was first initialized, as of each `secondsAgo` |

### prepayTimepointsStorageSlots

```solidity
function prepayTimepointsStorageSlots(uint16 startIndex, uint16 amount) external
```
**Selector**: `0xda705235`

Fills uninitialized timepoints with nonzero value

*Developer note: Can be used to reduce the gas cost of future swaps*

| Name | Type | Description |
| ---- | ---- | ----------- |
| startIndex | uint16 | The start index, must be not initialized |
| amount | uint16 | of slots to fill, startIndex + amount must be <= type(uint16).max |

