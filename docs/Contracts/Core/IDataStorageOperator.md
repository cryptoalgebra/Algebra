

# IDataStorageOperator


The interface for the DataStorageOperator



*Developer note: This contract stores timepoints and calculates adaptive fee and statistical averages*


## Events
### FeeConfiguration


`event FeeConfiguration(bool zto, struct AlgebraFeeConfiguration feeConfig)`  

Emitted when the fee configuration is changed
*Developer note: See the AdaptiveFee library for more details*



| Name | Type | Description |
| ---- | ---- | ----------- |
| zto | bool | Direction for new feeConfig (ZtO or OtZ) |
| feeConfig | struct AlgebraFeeConfiguration | The structure with dynamic fee parameters |




## Functions
### timepoints


`function timepoints(uint256 index) external view returns (bool initialized, uint32 blockTimestamp, int56 tickCumulative, uint88 volatilityCumulative, int24 tick, int24 averageTick, uint16 windowStartIndex)` view external

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
| windowStartIndex | uint16 | Index of closest timepoint &gt;&#x3D; WINDOW seconds ago |

### initialize


`function initialize(uint32 time, int24 tick) external`  external

Initialize the dataStorage array by writing the first slot. Called once for the lifecycle of the timepoints array



| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 | The time of the dataStorage initialization, via block.timestamp truncated to uint32 |
| tick | int24 | Initial tick |


### getSingleTimepoint


`function getSingleTimepoint(uint32 time, uint32 secondsAgo, int24 tick, uint16 index) external view returns (int56 tickCumulative, uint112 volatilityCumulative)` view external


*Developer note: Reverts if a timepoint at or before the desired timepoint timestamp does not exist.
0 may be passed as &#x60;secondsAgo&#x27; to return the current cumulative values.
If called with a timestamp falling between two timepoints, returns the counterfactual accumulator values
at exactly the timestamp between the two timepoints.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 | The current block timestamp |
| secondsAgo | uint32 | The amount of time to look back, in seconds, at which point to return a timepoint |
| tick | int24 | The current tick |
| index | uint16 | The index of the timepoint that was most recently written to the timepoints array |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulative | int56 | The cumulative tick since the pool was first initialized, as of &#x60;secondsAgo&#x60; |
| volatilityCumulative | uint112 | The cumulative volatility value since the pool was first initialized, as of &#x60;secondsAgo&#x60; |

### getTimepoints


`function getTimepoints(uint32[] secondsAgos) external view returns (int56[] tickCumulatives, uint112[] volatilityCumulatives)` view external

Returns the accumulator values as of each time seconds ago from the given time in the array of &#x60;secondsAgos&#x60;
*Developer note: Reverts if &#x60;secondsAgos&#x60; &gt; oldest timepoint*



| Name | Type | Description |
| ---- | ---- | ----------- |
| secondsAgos | uint32[] | Each amount of time to look back, in seconds, at which point to return a timepoint |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulatives | int56[] | The cumulative tick since the pool was first initialized, as of each &#x60;secondsAgo&#x60; |
| volatilityCumulatives | uint112[] | The cumulative volatility values since the pool was first initialized, as of each &#x60;secondsAgo&#x60; |

### write


`function write(uint16 index, uint32 blockTimestamp, int24 tick) external returns (uint16 indexUpdated, uint16 newFeeZtO, uint16 newFeeOtZ)`  external

Writes a dataStorage timepoint to the array
*Developer note: Writable at most once per block. Index represents the most recently written element. index must be tracked externally.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint16 | The index of the timepoint that was most recently written to the timepoints array |
| blockTimestamp | uint32 | The timestamp of the new timepoint |
| tick | int24 | The active tick at the time of the new timepoint |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| indexUpdated | uint16 | The new index of the most recently written element in the dataStorage array |
| newFeeZtO | uint16 | The fee for ZtO swaps in hundredths of a bip, i.e. 1e-6 |
| newFeeOtZ | uint16 | The fee for OtZ swaps in hundredths of a bip, i.e. 1e-6 |

### changeFeeConfiguration


`function changeFeeConfiguration(bool zto, struct AlgebraFeeConfiguration feeConfig) external`  external

Changes fee configuration for the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| zto | bool |  |
| feeConfig | struct AlgebraFeeConfiguration |  |


### prepayTimepointsStorageSlots


`function prepayTimepointsStorageSlots(uint16 startIndex, uint16 amount) external`  external

Fills uninitialized timepoints with nonzero value
*Developer note: Can be used to reduce the gas cost of future swaps*



| Name | Type | Description |
| ---- | ---- | ----------- |
| startIndex | uint16 | The start index, must be not initialized |
| amount | uint16 | of slots to fill, startIndex + amount must be &lt;&#x3D; type(uint16).max |






---

