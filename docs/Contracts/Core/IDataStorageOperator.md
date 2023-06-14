

# IDataStorageOperator








## Events
### FeeConfiguration


`event FeeConfiguration(struct AdaptiveFee.Configuration feeConfig)`  





| Name | Type | Description |
| ---- | ---- | ----------- |
| feeConfig | struct AdaptiveFee.Configuration |  |




## Functions
### timepoints


`function timepoints(uint256 index) external view returns (bool initialized, uint32 blockTimestamp, int56 tickCumulative, uint160 secondsPerLiquidityCumulative, uint88 volatilityCumulative, int24 averageTick, uint144 volumePerLiquidityCumulative)` view external

Returns data belonging to a certain timepoint
*Developer note: There is more convenient function to fetch a timepoint: observe(). Which requires not an index but seconds*



| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint256 | The index of timepoint in the array |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| initialized | bool | Whether the timepoint has been initialized and the values are safe to use, blockTimestamp The timestamp of the observation, tickCumulative The tick multiplied by seconds elapsed for the life of the pool as of the timepoint timestamp, secondsPerLiquidityCumulative The seconds per in range liquidity for the life of the pool as of the timepoint timestamp, volatilityCumulative Cumulative standard deviation for the life of the pool as of the timepoint timestamp, averageTick Time-weighted average tick, volumePerLiquidityCumulative Cumulative swap volume per liquidity for the life of the pool as of the timepoint timestamp |
| blockTimestamp | uint32 |  |
| tickCumulative | int56 |  |
| secondsPerLiquidityCumulative | uint160 |  |
| volatilityCumulative | uint88 |  |
| averageTick | int24 |  |
| volumePerLiquidityCumulative | uint144 |  |

### initialize


`function initialize(uint32 time, int24 tick) external`  external

Initialize the dataStorage array by writing the first slot. Called once for the lifecycle of the timepoints array



| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 | The time of the dataStorage initialization, via block.timestamp truncated to uint32 |
| tick | int24 | Initial tick |


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

### changeFeeConfiguration


`function changeFeeConfiguration(struct AdaptiveFee.Configuration feeConfig) external`  external

Changes fee configuration for the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| feeConfig | struct AdaptiveFee.Configuration |  |


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


`function window() external view returns (uint32 windowLength)` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| windowLength | uint32 | Length of window used to calculate averages |

### getFee


`function getFee(uint32 time, int24 tick, uint16 index, uint128 liquidity) external view returns (uint16 fee)` view external

Calculates fee based on combination of sigmoids



| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 | The current block.timestamp |
| tick | int24 | The current tick |
| index | uint16 | The index of the timepoint that was most recently written to the timepoints array |
| liquidity | uint128 | The current in-range pool liquidity |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| fee | uint16 | The fee in hundredths of a bip, i.e. 1e-6 |




