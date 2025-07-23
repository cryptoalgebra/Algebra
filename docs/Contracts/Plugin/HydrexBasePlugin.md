

# HydrexBasePlugin


Algebra Integral 1.2.1 plugin. Contains adaptive + sliding fee, safety switch and twap oracle



**Inherits:** [DynamicFeePlugin](plugins/DynamicFeePlugin.md) [VolatilityOraclePlugin](plugins/VolatilityOraclePlugin.md) [SlidingFeePlugin](plugins/SlidingFeePlugin.md) [SecurityPlugin](plugins/SecurityPlugin.md) [AlmPlugin](plugins/AlmPlugin.md)

## Public variables
### defaultPluginConfig
```solidity
uint8 constant defaultPluginConfig
```
**Selector**: `0x689ea370`

Returns plugin config



## Functions
### constructor

```solidity
constructor(address _pool, address _factory, address _pluginFactory, struct AlgebraFeeConfiguration _config, uint16 _baseFee) public
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| _pool | address |  |
| _factory | address |  |
| _pluginFactory | address |  |
| _config | struct AlgebraFeeConfiguration |  |
| _baseFee | uint16 |  |

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
function beforeModifyPosition(address, address, int24, int24, int128 liquidity, bytes) external returns (bytes4, uint24)
```
**Selector**: `0x5e2411b2`



*Developer note: unused*

| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |
|  | address |  |
|  | int24 |  |
|  | int24 |  |
| liquidity | int128 |  |
|  | bytes |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes4 |  |
| [1] | uint24 |  |

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
function beforeSwap(address, address, bool zeroToOne, int256, uint160, bool, bytes) external returns (bytes4, uint24, uint24)
```
**Selector**: `0x029c1cb7`



| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |
|  | address |  |
| zeroToOne | bool |  |
|  | int256 |  |
|  | uint160 |  |
|  | bool |  |
|  | bytes |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes4 |  |
| [1] | uint24 |  |
| [2] | uint24 |  |

### afterSwap

```solidity
function afterSwap(address, address, bool, int256, uint160, int256, int256, bytes) external returns (bytes4)
```
**Selector**: `0x9cb5a963`



| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |
|  | address |  |
|  | bool |  |
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

