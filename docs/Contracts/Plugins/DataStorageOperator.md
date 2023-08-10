

# DataStorageOperator


Algebra default plugin

This contract stores timepoints and calculates adaptive fee and statistical averages

## Modifiers
### onlyPool

```solidity
modifier onlyPool()
```




## Variables
### struct DataStorage.Timepoint[65536] timepoints 

Returns data belonging to a certain timepoint

*Developer note: There is more convenient function to fetch a timepoint: getTimepoints(). Which requires not an index but seconds*

### uint16 timepointIndex 




### uint32 lastTimepointTimestamp 




### struct AlgebraFeeConfiguration feeConfig 




### bytes32 FEE_CONFIG_MANAGER constant



*Developer note: The role can be granted in AlgebraFactory*

### address incentive 




### uint8 defaultPluginConfig constant

Returns plugin config



## Functions
### constructor

```solidity
constructor(address _pool, address _factory, address _pluginFactory) public
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| _pool | address |  |
| _factory | address |  |
| _pluginFactory | address |  |

### initialize

```solidity
function initialize() external
```

Initialize the plugin externally TODO

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

### changeFeeConfiguration

```solidity
function changeFeeConfiguration(struct AlgebraFeeConfiguration _config) external
```

Changes fee configuration for the pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| _config | struct AlgebraFeeConfiguration |  |

### getCurrentFee

```solidity
function getCurrentFee() external view returns (uint16 fee)
```

Returns fee from plugin

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| fee | uint16 | The pool fee value in hundredths of a bip, i.e. 1e-6 |

### setIncentive

```solidity
function setIncentive(address newIncentive) external
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| newIncentive | address |  |

### isIncentiveActive

```solidity
function isIncentiveActive(address targetIncentive) external view returns (bool)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| targetIncentive | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

### beforeInitialize

```solidity
function beforeInitialize(address, uint160) external returns (bytes4)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |
|  | uint160 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes4 |  |

### afterInitialize

```solidity
function afterInitialize(address, uint160, int24 tick) external returns (bytes4)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |
|  | uint160 |  |
| tick | int24 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes4 |  |

### beforeModifyPosition

```solidity
function beforeModifyPosition(address, address, int24, int24, int128, bytes) external view returns (bytes4)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |
|  | address |  |
|  | int24 |  |
|  | int24 |  |
|  | int128 |  |
|  | bytes |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes4 |  |

### afterModifyPosition

```solidity
function afterModifyPosition(address, address, int24, int24, int128, uint256, uint256, bytes) external returns (bytes4)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |
|  | address |  |
|  | int24 |  |
|  | int24 |  |
|  | int128 |  |
|  | uint256 |  |
|  | uint256 |  |
|  | bytes |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes4 |  |

### beforeSwap

```solidity
function beforeSwap(address, address, bool, int256, uint160, bool, bytes) external returns (bytes4)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |
|  | address |  |
|  | bool |  |
|  | int256 |  |
|  | uint160 |  |
|  | bool |  |
|  | bytes |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes4 |  |

### afterSwap

```solidity
function afterSwap(address, address, bool zeroToOne, int256, uint160, int256, int256, bytes) external returns (bytes4)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |
|  | address |  |
| zeroToOne | bool |  |
|  | int256 |  |
|  | uint160 |  |
|  | int256 |  |
|  | int256 |  |
|  | bytes |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes4 |  |

### beforeFlash

```solidity
function beforeFlash(address, address, uint256, uint256, bytes) external view returns (bytes4)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |
|  | address |  |
|  | uint256 |  |
|  | uint256 |  |
|  | bytes |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes4 |  |

### afterFlash

```solidity
function afterFlash(address, address, uint256, uint256, uint256, uint256, bytes) external view returns (bytes4)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |
|  | address |  |
|  | uint256 |  |
|  | uint256 |  |
|  | uint256 |  |
|  | uint256 |  |
|  | bytes |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes4 |  |

