

# IDataStorageOperator





## Events
### FeeConfiguration


`FeeConfiguration(struct AdaptiveFee.Configuration)`  





| Name | Type | Description |
| ---- | ---- | ----------- |
| feeConfig | struct AdaptiveFee.Configuration |  |




## Functions
### timepoints


`timepoints(uint256)` view external

Returns data belonging to a certain timepoint



| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint256 | The index of timepoint in the array |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| initialized | bool |  |
| blockTimestamp | uint32 |  |
| tickCumulative | int56 |  |
| secondsPerLiquidityCumulative | uint160 |  |
| volatilityCumulative | uint88 |  |
| averageTick | int24 |  |
| volumePerLiquidityCumulative | uint144 |  |

### initialize


`initialize(uint32,int24)`  external

Initialize the dataStorage array by writing the first slot. Called once for the lifecycle of the timepoints array



| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 | The time of the dataStorage initialization, via block.timestamp truncated to uint32 |
| tick | int24 | Initial tick |


### getSingleTimepoint


`getSingleTimepoint(uint32,uint32,int24,uint16,uint128)` view external





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
| tickCumulative | int56 |  |
| secondsPerLiquidityCumulative | uint160 |  |
| volatilityCumulative | uint112 |  |
| volumePerAvgLiquidity | uint256 |  |

### getTimepoints


`getTimepoints(uint32,uint32[],int24,uint16,uint128)` view external

Returns the accumulator values as of each time seconds ago from the given time in the array of &#x60;secondsAgos&#x60;



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
| tickCumulatives | int56[] |  |
| secondsPerLiquidityCumulatives | uint160[] |  |
| volatilityCumulatives | uint112[] |  |
| volumePerAvgLiquiditys | uint256[] |  |

### getAverages


`getAverages(uint32,int24,uint16,uint128)` view external

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
| TWVolatilityAverage | uint112 |  |
| TWVolumePerLiqAverage | uint256 |  |

### write


`write(uint16,uint32,int24,uint128,uint128)`  external

Writes an dataStorage timepoint to the array



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
| indexUpdated | uint16 |  |

### changeFeeConfiguration


`changeFeeConfiguration(struct AdaptiveFee.Configuration)`  external

Changes fee configuration for the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| feeConfig | struct AdaptiveFee.Configuration |  |


### calculateVolumePerLiquidity


`calculateVolumePerLiquidity(uint128,int256,int256)` pure external

Calculates gmean(volume/liquidity) for block



| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidity | uint128 | The current in-range pool liquidity |
| amount0 | int256 | Total amount of swapped token0 |
| amount1 | int256 | Total amount of swapped token1 |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| volumePerLiquidity | uint128 |  |

### window


`window()` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| windowLength | uint32 |  |

### getFee


`getFee(uint32,int24,uint16,uint128)` view external

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
| fee | uint16 |  |



---




# IDataStorageOperator





## Events
### FeeConfiguration


`FeeConfiguration(struct AdaptiveFee.Configuration)`  





| Name | Type | Description |
| ---- | ---- | ----------- |
| feeConfig | struct AdaptiveFee.Configuration |  |




## Functions
### timepoints


`timepoints(uint256)` view external

Returns data belonging to a certain timepoint



| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint256 | The index of timepoint in the array |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| initialized | bool |  |
| blockTimestamp | uint32 |  |
| tickCumulative | int56 |  |
| secondsPerLiquidityCumulative | uint160 |  |
| volatilityCumulative | uint88 |  |
| averageTick | int24 |  |
| volumePerLiquidityCumulative | uint144 |  |

### initialize


`initialize(uint32,int24)`  external

Initialize the dataStorage array by writing the first slot. Called once for the lifecycle of the timepoints array



| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 | The time of the dataStorage initialization, via block.timestamp truncated to uint32 |
| tick | int24 | Initial tick |


### getSingleTimepoint


`getSingleTimepoint(uint32,uint32,int24,uint16,uint128)` view external





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
| tickCumulative | int56 |  |
| secondsPerLiquidityCumulative | uint160 |  |
| volatilityCumulative | uint112 |  |
| volumePerAvgLiquidity | uint256 |  |

### getTimepoints


`getTimepoints(uint32,uint32[],int24,uint16,uint128)` view external

Returns the accumulator values as of each time seconds ago from the given time in the array of &#x60;secondsAgos&#x60;



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
| tickCumulatives | int56[] |  |
| secondsPerLiquidityCumulatives | uint160[] |  |
| volatilityCumulatives | uint112[] |  |
| volumePerAvgLiquiditys | uint256[] |  |

### getAverages


`getAverages(uint32,int24,uint16,uint128)` view external

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
| TWVolatilityAverage | uint112 |  |
| TWVolumePerLiqAverage | uint256 |  |

### write


`write(uint16,uint32,int24,uint128,uint128)`  external

Writes an dataStorage timepoint to the array



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
| indexUpdated | uint16 |  |

### changeFeeConfiguration


`changeFeeConfiguration(struct AdaptiveFee.Configuration)`  external

Changes fee configuration for the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| feeConfig | struct AdaptiveFee.Configuration |  |


### calculateVolumePerLiquidity


`calculateVolumePerLiquidity(uint128,int256,int256)` pure external

Calculates gmean(volume/liquidity) for block



| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidity | uint128 | The current in-range pool liquidity |
| amount0 | int256 | Total amount of swapped token0 |
| amount1 | int256 | Total amount of swapped token1 |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| volumePerLiquidity | uint128 |  |

### window


`window()` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| windowLength | uint32 |  |

### getFee


`getFee(uint32,int24,uint16,uint128)` view external

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
| fee | uint16 |  |



---




# IDataStorageOperator





## Events
### FeeConfiguration


`FeeConfiguration(struct AdaptiveFee.Configuration)`  





| Name | Type | Description |
| ---- | ---- | ----------- |
| feeConfig | struct AdaptiveFee.Configuration |  |




## Functions
### timepoints


`timepoints(uint256)` view external

Returns data belonging to a certain timepoint



| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint256 | The index of timepoint in the array |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| initialized | bool |  |
| blockTimestamp | uint32 |  |
| tickCumulative | int56 |  |
| secondsPerLiquidityCumulative | uint160 |  |
| volatilityCumulative | uint88 |  |
| averageTick | int24 |  |
| volumePerLiquidityCumulative | uint144 |  |

### initialize


`initialize(uint32,int24)`  external

Initialize the dataStorage array by writing the first slot. Called once for the lifecycle of the timepoints array



| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 | The time of the dataStorage initialization, via block.timestamp truncated to uint32 |
| tick | int24 | Initial tick |


### getSingleTimepoint


`getSingleTimepoint(uint32,uint32,int24,uint16,uint128)` view external





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
| tickCumulative | int56 |  |
| secondsPerLiquidityCumulative | uint160 |  |
| volatilityCumulative | uint112 |  |
| volumePerAvgLiquidity | uint256 |  |

### getTimepoints


`getTimepoints(uint32,uint32[],int24,uint16,uint128)` view external

Returns the accumulator values as of each time seconds ago from the given time in the array of &#x60;secondsAgos&#x60;



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
| tickCumulatives | int56[] |  |
| secondsPerLiquidityCumulatives | uint160[] |  |
| volatilityCumulatives | uint112[] |  |
| volumePerAvgLiquiditys | uint256[] |  |

### getAverages


`getAverages(uint32,int24,uint16,uint128)` view external

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
| TWVolatilityAverage | uint112 |  |
| TWVolumePerLiqAverage | uint256 |  |

### write


`write(uint16,uint32,int24,uint128,uint128)`  external

Writes an dataStorage timepoint to the array



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
| indexUpdated | uint16 |  |

### changeFeeConfiguration


`changeFeeConfiguration(struct AdaptiveFee.Configuration)`  external

Changes fee configuration for the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| feeConfig | struct AdaptiveFee.Configuration |  |


### calculateVolumePerLiquidity


`calculateVolumePerLiquidity(uint128,int256,int256)` pure external

Calculates gmean(volume/liquidity) for block



| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidity | uint128 | The current in-range pool liquidity |
| amount0 | int256 | Total amount of swapped token0 |
| amount1 | int256 | Total amount of swapped token1 |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| volumePerLiquidity | uint128 |  |

### window


`window()` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| windowLength | uint32 |  |

### getFee


`getFee(uint32,int24,uint16,uint128)` view external

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
| fee | uint16 |  |



---




# IDataStorageOperator





## Events
### FeeConfiguration


`FeeConfiguration(struct AdaptiveFee.Configuration)`  





| Name | Type | Description |
| ---- | ---- | ----------- |
| feeConfig | struct AdaptiveFee.Configuration |  |




## Functions
### timepoints


`timepoints(uint256)` view external

Returns data belonging to a certain timepoint



| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint256 | The index of timepoint in the array |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| initialized | bool |  |
| blockTimestamp | uint32 |  |
| tickCumulative | int56 |  |
| secondsPerLiquidityCumulative | uint160 |  |
| volatilityCumulative | uint88 |  |
| averageTick | int24 |  |
| volumePerLiquidityCumulative | uint144 |  |

### initialize


`initialize(uint32,int24)`  external

Initialize the dataStorage array by writing the first slot. Called once for the lifecycle of the timepoints array



| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 | The time of the dataStorage initialization, via block.timestamp truncated to uint32 |
| tick | int24 | Initial tick |


### getSingleTimepoint


`getSingleTimepoint(uint32,uint32,int24,uint16,uint128)` view external





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
| tickCumulative | int56 |  |
| secondsPerLiquidityCumulative | uint160 |  |
| volatilityCumulative | uint112 |  |
| volumePerAvgLiquidity | uint256 |  |

### getTimepoints


`getTimepoints(uint32,uint32[],int24,uint16,uint128)` view external

Returns the accumulator values as of each time seconds ago from the given time in the array of &#x60;secondsAgos&#x60;



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
| tickCumulatives | int56[] |  |
| secondsPerLiquidityCumulatives | uint160[] |  |
| volatilityCumulatives | uint112[] |  |
| volumePerAvgLiquiditys | uint256[] |  |

### getAverages


`getAverages(uint32,int24,uint16,uint128)` view external

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
| TWVolatilityAverage | uint112 |  |
| TWVolumePerLiqAverage | uint256 |  |

### write


`write(uint16,uint32,int24,uint128,uint128)`  external

Writes an dataStorage timepoint to the array



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
| indexUpdated | uint16 |  |

### changeFeeConfiguration


`changeFeeConfiguration(struct AdaptiveFee.Configuration)`  external

Changes fee configuration for the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| feeConfig | struct AdaptiveFee.Configuration |  |


### calculateVolumePerLiquidity


`calculateVolumePerLiquidity(uint128,int256,int256)` pure external

Calculates gmean(volume/liquidity) for block



| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidity | uint128 | The current in-range pool liquidity |
| amount0 | int256 | Total amount of swapped token0 |
| amount1 | int256 | Total amount of swapped token1 |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| volumePerLiquidity | uint128 |  |

### window


`window()` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| windowLength | uint32 |  |

### getFee


`getFee(uint32,int24,uint16,uint128)` view external

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
| fee | uint16 |  |



---


