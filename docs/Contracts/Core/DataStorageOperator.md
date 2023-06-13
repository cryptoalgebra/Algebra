

# DataStorageOperator







## Modifiers
### onlyPool


`modifier onlyPool()`  internal









## Variables
### struct DataStorage.Timepoint[65536] timepoints 

Returns data belonging to a certain timepoint

*Developer note: There is more convenient function to fetch a timepoint: getTimepoints(). Which requires not an index but seconds*
### struct AdaptiveFee.Configuration feeConfigZto 



### struct AdaptiveFee.Configuration feeConfigOtz 




## Functions
### constructor


`constructor(address _pool) public`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _pool | address |  |


### initialize


`function initialize(uint32 time, int24 tick) external`  external

Initialize the dataStorage array by writing the first slot. Called once for the lifecycle of the timepoints array



| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 | The time of the dataStorage initialization, via block.timestamp truncated to uint32 |
| tick | int24 | Initial tick |


### changeFeeConfiguration


`function changeFeeConfiguration(bool zto, struct AdaptiveFee.Configuration _feeConfig) external`  external

Changes fee configuration for the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| zto | bool |  |
| _feeConfig | struct AdaptiveFee.Configuration |  |


### getSingleTimepoint


`function getSingleTimepoint(uint32 time, uint32 secondsAgo, int24 tick, uint16 index, uint128 liquidity) external view returns (int56 tickCumulative, uint160 secondsPerLiquidityCumulative, uint112 volatilityCumulative, uint256 volumePerAvgLiquidity)` view external


*Developer note: Reverts if an timepoint at or before the desired timepoint timestamp does not exist.
0 may be passed as &#x60;secondsAgo&#x27; to return the current cumulative values.
If called with a timestamp falling between two timepoints, returns the counterfactual accumulator values
at exactly the timestamp between the two timepoints.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 | The current block timestamp |
| secondsAgo | uint32 | The amount of time to look back, in seconds, at which point to return an timepoint |
| tick | int24 | The current tick |
| index | uint16 | The index of the timepoint that was most recently written to the timepoints array |
| liquidity | uint128 | The current in-range pool liquidity |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulative | int56 | The cumulative tick since the pool was first initialized, as of &#x60;secondsAgo&#x60; |
| secondsPerLiquidityCumulative | uint160 | The cumulative seconds / max(1, liquidity) since the pool was first initialized, as of &#x60;secondsAgo&#x60; |
| volatilityCumulative | uint112 | The cumulative volatility value since the pool was first initialized, as of &#x60;secondsAgo&#x60; |
| volumePerAvgLiquidity | uint256 | The cumulative volume per liquidity value since the pool was first initialized, as of &#x60;secondsAgo&#x60; |

### getTimepoints


`function getTimepoints(uint32 time, uint32[] secondsAgos, int24 tick, uint16 index, uint128 liquidity) external view returns (int56[] tickCumulatives, uint160[] secondsPerLiquidityCumulatives, uint112[] volatilityCumulatives, uint256[] volumePerAvgLiquiditys)` view external

Returns the accumulator values as of each time seconds ago from the given time in the array of &#x60;secondsAgos&#x60;
*Developer note: Reverts if &#x60;secondsAgos&#x60; &gt; oldest timepoint*



| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 | The current block.timestamp |
| secondsAgos | uint32[] | Each amount of time to look back, in seconds, at which point to return an timepoint |
| tick | int24 | The current tick |
| index | uint16 | The index of the timepoint that was most recently written to the timepoints array |
| liquidity | uint128 | The current in-range pool liquidity |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulatives | int56[] | The cumulative tick since the pool was first initialized, as of each &#x60;secondsAgo&#x60; |
| secondsPerLiquidityCumulatives | uint160[] | The cumulative seconds / max(1, liquidity) since the pool was first initialized, as of each &#x60;secondsAgo&#x60; |
| volatilityCumulatives | uint112[] | The cumulative volatility values since the pool was first initialized, as of each &#x60;secondsAgo&#x60; |
| volumePerAvgLiquiditys | uint256[] | The cumulative volume per liquidity values since the pool was first initialized, as of each &#x60;secondsAgo&#x60; |

### getAverages


`function getAverages(uint32 time, int24 tick, uint16 index, uint128 liquidity) external view returns (uint112 TWVolatilityAverage, uint256 TWVolumePerLiqAverage)` view external

Returns average volatility in the range from time-WINDOW to time



| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 | The current block.timestamp |
| tick | int24 | The current tick |
| index | uint16 | The index of the timepoint that was most recently written to the timepoints array |
| liquidity | uint128 | The current in-range pool liquidity |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| TWVolatilityAverage | uint112 | The average volatility in the recent range |
| TWVolumePerLiqAverage | uint256 | The average volume per liquidity in the recent range |

### write


`function write(uint16 index, uint32 blockTimestamp, int24 tick, uint128 liquidity, uint128 volumePerLiquidity) external returns (uint16 indexUpdated)`  external

Writes an dataStorage timepoint to the array
*Developer note: Writable at most once per block. Index represents the most recently written element. index must be tracked externally.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint16 | The index of the timepoint that was most recently written to the timepoints array |
| blockTimestamp | uint32 | The timestamp of the new timepoint |
| tick | int24 | The active tick at the time of the new timepoint |
| liquidity | uint128 | The total in-range liquidity at the time of the new timepoint |
| volumePerLiquidity | uint128 | The gmean(volumes)/liquidity at the time of the new timepoint |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| indexUpdated | uint16 | The new index of the most recently written element in the dataStorage array |

### calculateVolumePerLiquidity


`function calculateVolumePerLiquidity(uint128 liquidity, int256 amount0, int256 amount1) external pure returns (uint128 volumePerLiquidity)` pure external

Calculates gmean(volume/liquidity) for block



| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidity | uint128 | The current in-range pool liquidity |
| amount0 | int256 | Total amount of swapped token0 |
| amount1 | int256 | Total amount of swapped token1 |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| volumePerLiquidity | uint128 | gmean(volume/liquidity) capped by 100000 &lt;&lt; 64 |

### window


`function window() external pure returns (uint32)` pure external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

### getFees


`function getFees(uint32 _time, int24 _tick, uint16 _index, uint128 _liquidity) external view returns (uint16 feeZto, uint16 feeOtz)` view external

Calculates fee based on combination of sigmoids



| Name | Type | Description |
| ---- | ---- | ----------- |
| _time | uint32 |  |
| _tick | int24 |  |
| _index | uint16 |  |
| _liquidity | uint128 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| feeZto | uint16 | The fee for ZtO swaps in hundredths of a bip, i.e. 1e-6 |
| feeOtz | uint16 | The fee for OtZ swaps in hundredths of a bip, i.e. 1e-6 |




