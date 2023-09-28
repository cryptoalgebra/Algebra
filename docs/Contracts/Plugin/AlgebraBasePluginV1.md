

# AlgebraBasePluginV1


Algebra default plugin

This contract stores timepoints and calculates adaptive fee and statistical averages

**Inherits:** [IAlgebraBasePluginV1](interfaces/IAlgebraBasePluginV1.md) Timestamp [IAlgebraPlugin](../Core/interfaces/plugin/IAlgebraPlugin.md)
## Modifiers
### onlyPool

```solidity
modifier onlyPool()
```




## Public variables
### ALGEBRA_BASE_PLUGIN_MANAGER
```solidity
bytes32 constant ALGEBRA_BASE_PLUGIN_MANAGER = 0x8e8000aba5b365c0be9685da1153f7f096e76d1ecfb42c050ae1e387aa65b4f5
```
**Selector**: `0x31b25d1a`



*Developer note: The role can be granted in AlgebraFactory*

### defaultPluginConfig
```solidity
uint8 constant defaultPluginConfig
```
**Selector**: `0x689ea370`

Returns plugin config


### pool
```solidity
address immutable pool
```
**Selector**: `0x16f0115b`

Returns the address of the pool the plugin is created for


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


### incentive
```solidity
address incentive
```
**Selector**: `0x1d4632ac`

Returns the address of active incentive

*Developer note: if there is no active incentive at the moment, incentiveAddress would be equal to address(0)*


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

### feeConfig

```solidity
function feeConfig() external view returns (uint16 alpha1, uint16 alpha2, uint32 beta1, uint32 beta2, uint16 gamma1, uint16 gamma2, uint16 baseFee)
```
**Selector**: `0x1e5eb1d0`

Current dynamic fee configuration

*Developer note: See the AdaptiveFee struct for more details*

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| alpha1 | uint16 |  |
| alpha2 | uint16 |  |
| beta1 | uint32 |  |
| beta2 | uint32 |  |
| gamma1 | uint16 |  |
| gamma2 | uint16 |  |
| baseFee | uint16 |  |

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

### changeFeeConfiguration

```solidity
function changeFeeConfiguration(struct AlgebraFeeConfiguration _config) external
```
**Selector**: `0x1d39215e`

Changes fee configuration for the pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| _config | struct AlgebraFeeConfiguration |  |

### getCurrentFee

```solidity
function getCurrentFee() external view returns (uint16 fee)
```
**Selector**: `0xf70d9362`

Returns fee from plugin

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| fee | uint16 | The pool fee value in hundredths of a bip, i.e. 1e-6 |

### setIncentive

```solidity
function setIncentive(address newIncentive) external
```
**Selector**: `0x7c1fe0c8`

Connects or disconnects an incentive.

*Developer note: Only farming can connect incentives.
The one who connected it and the current farming has the right to disconnect the incentive.*

| Name | Type | Description |
| ---- | ---- | ----------- |
| newIncentive | address | The address associated with the incentive or zero address |

### isIncentiveConnected

```solidity
function isIncentiveConnected(address targetIncentive) external view returns (bool)
```
**Selector**: `0xe63015f0`

Checks if the incentive is connected to pool

*Developer note: Returns false if the plugin has a different incentive set, the plugin is not connected to the pool,
or the plugin configuration is incorrect.*

| Name | Type | Description |
| ---- | ---- | ----------- |
| targetIncentive | address | The address of the incentive to be checked |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | Indicates whether the target incentive is active |

### beforeInitialize

```solidity
function beforeInitialize(address, uint160) external returns (bytes4)
```
**Selector**: `0x636fd804`



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
**Selector**: `0x82dd6522`



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
function beforeModifyPosition(address, address, int24, int24, int128, bytes) external returns (bytes4)
```
**Selector**: `0x5e2411b2`



*Developer note: unused*

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
**Selector**: `0xd6852010`



*Developer note: unused*

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
**Selector**: `0x029c1cb7`



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
**Selector**: `0x9cb5a963`



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
function beforeFlash(address, address, uint256, uint256, bytes) external returns (bytes4)
```
**Selector**: `0x8de0a8ee`



*Developer note: unused*

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
function afterFlash(address, address, uint256, uint256, uint256, uint256, bytes) external returns (bytes4)
```
**Selector**: `0x343d37ff`



*Developer note: unused*

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

