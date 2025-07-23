

# CustomPlugin






**Inherits:** Timestamp [IAlgebraPlugin](../../Core/interfaces/plugin/IAlgebraPlugin.md)

## Public variables
### pool
```solidity
address pool
```
**Selector**: `0x16f0115b`




### ALGEBRA_BASE_PLUGIN_MANAGER
```solidity
bytes32 constant ALGEBRA_BASE_PLUGIN_MANAGER = 0x8e8000aba5b365c0be9685da1153f7f096e76d1ecfb42c050ae1e387aa65b4f5
```
**Selector**: `0x31b25d1a`




### defaultPluginConfig
```solidity
uint8 constant defaultPluginConfig
```
**Selector**: `0x689ea370`

Returns plugin config



## Functions
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
function afterInitialize(address, uint160, int24) external returns (bytes4)
```
**Selector**: `0x82dd6522`



| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |
|  | uint160 |  |
|  | int24 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes4 |  |

### beforeModifyPosition

```solidity
function beforeModifyPosition(address, address, int24, int24, int128, bytes) external returns (bytes4, uint24)
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
function beforeSwap(address, address, bool, int256, uint160, bool, bytes) external returns (bytes4, uint24, uint24)
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

### handlePluginFee

```solidity
function handlePluginFee(uint256, uint256) external pure returns (bytes4)
```
**Selector**: `0xaa6b14bb`



| Name | Type | Description |
| ---- | ---- | ----------- |
|  | uint256 |  |
|  | uint256 |  |

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

