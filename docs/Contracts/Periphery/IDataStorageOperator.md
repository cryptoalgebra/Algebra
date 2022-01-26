

# IDataStorageOperator




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





| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 |  |
| tick | int24 |  |


### getSingleTimepoint


`getSingleTimepoint(uint32,uint32,int24,uint16,uint128)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 |  |
| secondsAgo | uint32 |  |
| tick | int24 |  |
| index | uint16 |  |
| liquidity | uint128 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulative | int56 |  |
| secondsPerLiquidityCumulative | uint160 |  |
| volatilityCumulative | uint112 |  |
| volumePerAvgLiquidity | uint256 |  |

### getTimepoints


`getTimepoints(uint32,uint32[],int24,uint16,uint128)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 |  |
| secondsAgos | uint32[] |  |
| tick | int24 |  |
| index | uint16 |  |
| liquidity | uint128 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulatives | int56[] |  |
| secondsPerLiquidityCumulatives | uint160[] |  |
| volatilityCumulatives | uint112[] |  |
| volumePerAvgLiquiditys | uint256[] |  |

### getAverages


`getAverages(uint32,int24,uint16,uint128)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 |  |
| tick | int24 |  |
| index | uint16 |  |
| liquidity | uint128 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| TWVolatilityAverage | uint112 |  |
| TWVolumePerLiqAverage | uint256 |  |

### write


`write(uint16,uint32,int24,uint128,uint128)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint16 |  |
| blockTimestamp | uint32 |  |
| tick | int24 |  |
| liquidity | uint128 |  |
| volumePerLiquidity | uint128 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| indexUpdated | uint16 |  |

### changeFeeConfiguration


`changeFeeConfiguration(uint32,uint32,uint32,uint32,uint16,uint16,uint32,uint32,uint16)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| alpha1 | uint32 |  |
| alpha2 | uint32 |  |
| beta1 | uint32 |  |
| beta2 | uint32 |  |
| gamma1 | uint16 |  |
| gamma2 | uint16 |  |
| volumeBeta | uint32 |  |
| volumeGamma | uint32 |  |
| baseFee | uint16 |  |


### calculateVolumePerLiquidity


`calculateVolumePerLiquidity(uint128,int256,int256)` pure external





| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidity | uint128 |  |
| amount0 | int256 |  |
| amount1 | int256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| volumePerLiquidity | uint128 |  |

### WINDOW


`WINDOW()` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

### getFee


`getFee(uint32,int24,uint16,uint128)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _time | uint32 |  |
| _tick | int24 |  |
| _index | uint16 |  |
| _liquidity | uint128 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| fee | uint16 |  |



---




# IDataStorageOperator




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





| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 |  |
| tick | int24 |  |


### getSingleTimepoint


`getSingleTimepoint(uint32,uint32,int24,uint16,uint128)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 |  |
| secondsAgo | uint32 |  |
| tick | int24 |  |
| index | uint16 |  |
| liquidity | uint128 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulative | int56 |  |
| secondsPerLiquidityCumulative | uint160 |  |
| volatilityCumulative | uint112 |  |
| volumePerAvgLiquidity | uint256 |  |

### getTimepoints


`getTimepoints(uint32,uint32[],int24,uint16,uint128)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 |  |
| secondsAgos | uint32[] |  |
| tick | int24 |  |
| index | uint16 |  |
| liquidity | uint128 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulatives | int56[] |  |
| secondsPerLiquidityCumulatives | uint160[] |  |
| volatilityCumulatives | uint112[] |  |
| volumePerAvgLiquiditys | uint256[] |  |

### getAverages


`getAverages(uint32,int24,uint16,uint128)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 |  |
| tick | int24 |  |
| index | uint16 |  |
| liquidity | uint128 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| TWVolatilityAverage | uint112 |  |
| TWVolumePerLiqAverage | uint256 |  |

### write


`write(uint16,uint32,int24,uint128,uint128)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint16 |  |
| blockTimestamp | uint32 |  |
| tick | int24 |  |
| liquidity | uint128 |  |
| volumePerLiquidity | uint128 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| indexUpdated | uint16 |  |

### changeFeeConfiguration


`changeFeeConfiguration(uint32,uint32,uint32,uint32,uint16,uint16,uint32,uint32,uint16)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| alpha1 | uint32 |  |
| alpha2 | uint32 |  |
| beta1 | uint32 |  |
| beta2 | uint32 |  |
| gamma1 | uint16 |  |
| gamma2 | uint16 |  |
| volumeBeta | uint32 |  |
| volumeGamma | uint32 |  |
| baseFee | uint16 |  |


### calculateVolumePerLiquidity


`calculateVolumePerLiquidity(uint128,int256,int256)` pure external





| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidity | uint128 |  |
| amount0 | int256 |  |
| amount1 | int256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| volumePerLiquidity | uint128 |  |

### WINDOW


`WINDOW()` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

### getFee


`getFee(uint32,int24,uint16,uint128)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _time | uint32 |  |
| _tick | int24 |  |
| _index | uint16 |  |
| _liquidity | uint128 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| fee | uint16 |  |



---




# IDataStorageOperator




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





| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 |  |
| tick | int24 |  |


### getSingleTimepoint


`getSingleTimepoint(uint32,uint32,int24,uint16,uint128)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 |  |
| secondsAgo | uint32 |  |
| tick | int24 |  |
| index | uint16 |  |
| liquidity | uint128 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulative | int56 |  |
| secondsPerLiquidityCumulative | uint160 |  |
| volatilityCumulative | uint112 |  |
| volumePerAvgLiquidity | uint256 |  |

### getTimepoints


`getTimepoints(uint32,uint32[],int24,uint16,uint128)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 |  |
| secondsAgos | uint32[] |  |
| tick | int24 |  |
| index | uint16 |  |
| liquidity | uint128 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulatives | int56[] |  |
| secondsPerLiquidityCumulatives | uint160[] |  |
| volatilityCumulatives | uint112[] |  |
| volumePerAvgLiquiditys | uint256[] |  |

### getAverages


`getAverages(uint32,int24,uint16,uint128)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 |  |
| tick | int24 |  |
| index | uint16 |  |
| liquidity | uint128 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| TWVolatilityAverage | uint112 |  |
| TWVolumePerLiqAverage | uint256 |  |

### write


`write(uint16,uint32,int24,uint128,uint128)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint16 |  |
| blockTimestamp | uint32 |  |
| tick | int24 |  |
| liquidity | uint128 |  |
| volumePerLiquidity | uint128 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| indexUpdated | uint16 |  |

### changeFeeConfiguration


`changeFeeConfiguration(uint32,uint32,uint32,uint32,uint16,uint16,uint32,uint32,uint16)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| alpha1 | uint32 |  |
| alpha2 | uint32 |  |
| beta1 | uint32 |  |
| beta2 | uint32 |  |
| gamma1 | uint16 |  |
| gamma2 | uint16 |  |
| volumeBeta | uint32 |  |
| volumeGamma | uint32 |  |
| baseFee | uint16 |  |


### calculateVolumePerLiquidity


`calculateVolumePerLiquidity(uint128,int256,int256)` pure external





| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidity | uint128 |  |
| amount0 | int256 |  |
| amount1 | int256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| volumePerLiquidity | uint128 |  |

### WINDOW


`WINDOW()` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

### getFee


`getFee(uint32,int24,uint16,uint128)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _time | uint32 |  |
| _tick | int24 |  |
| _index | uint16 |  |
| _liquidity | uint128 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| fee | uint16 |  |



---




# IDataStorageOperator




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





| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 |  |
| tick | int24 |  |


### getSingleTimepoint


`getSingleTimepoint(uint32,uint32,int24,uint16,uint128)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 |  |
| secondsAgo | uint32 |  |
| tick | int24 |  |
| index | uint16 |  |
| liquidity | uint128 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulative | int56 |  |
| secondsPerLiquidityCumulative | uint160 |  |
| volatilityCumulative | uint112 |  |
| volumePerAvgLiquidity | uint256 |  |

### getTimepoints


`getTimepoints(uint32,uint32[],int24,uint16,uint128)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 |  |
| secondsAgos | uint32[] |  |
| tick | int24 |  |
| index | uint16 |  |
| liquidity | uint128 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulatives | int56[] |  |
| secondsPerLiquidityCumulatives | uint160[] |  |
| volatilityCumulatives | uint112[] |  |
| volumePerAvgLiquiditys | uint256[] |  |

### getAverages


`getAverages(uint32,int24,uint16,uint128)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 |  |
| tick | int24 |  |
| index | uint16 |  |
| liquidity | uint128 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| TWVolatilityAverage | uint112 |  |
| TWVolumePerLiqAverage | uint256 |  |

### write


`write(uint16,uint32,int24,uint128,uint128)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint16 |  |
| blockTimestamp | uint32 |  |
| tick | int24 |  |
| liquidity | uint128 |  |
| volumePerLiquidity | uint128 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| indexUpdated | uint16 |  |

### changeFeeConfiguration


`changeFeeConfiguration(uint32,uint32,uint32,uint32,uint16,uint16,uint32,uint32,uint16)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| alpha1 | uint32 |  |
| alpha2 | uint32 |  |
| beta1 | uint32 |  |
| beta2 | uint32 |  |
| gamma1 | uint16 |  |
| gamma2 | uint16 |  |
| volumeBeta | uint32 |  |
| volumeGamma | uint32 |  |
| baseFee | uint16 |  |


### calculateVolumePerLiquidity


`calculateVolumePerLiquidity(uint128,int256,int256)` pure external





| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidity | uint128 |  |
| amount0 | int256 |  |
| amount1 | int256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| volumePerLiquidity | uint128 |  |

### WINDOW


`WINDOW()` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

### getFee


`getFee(uint32,int24,uint16,uint128)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _time | uint32 |  |
| _tick | int24 |  |
| _index | uint16 |  |
| _liquidity | uint128 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| fee | uint16 |  |



---


