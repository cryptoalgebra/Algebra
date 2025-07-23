

# BasePlugin


Algebra Integral 1.2.1 plugin base

This contract simplifies development process of plugins by providing base functionality

**Inherits:** [IBasePlugin](../interfaces/IBasePlugin.md) Timestamp
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

### pool
```solidity
address immutable pool
```
**Selector**: `0x16f0115b`





## Functions
### collectPluginFee

```solidity
function collectPluginFee(address token, uint256 amount, address recipient) external
```
**Selector**: `0xe72c652d`

Claim plugin fee

| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | The token address |
| amount | uint256 | Amount of tokens |
| recipient | address | Recipient address |

### handlePluginFee

```solidity
function handlePluginFee(uint256, uint256) external view returns (bytes4)
```
**Selector**: `0xaa6b14bb`

Handle plugin fee transfer on plugin contract

| Name | Type | Description |
| ---- | ---- | ----------- |
|  | uint256 |  |
|  | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes4 | bytes4 The function selector |

### beforeInitialize

```solidity
function beforeInitialize(address, uint160) external virtual returns (bytes4)
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
function afterInitialize(address, uint160, int24) external virtual returns (bytes4)
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
function beforeModifyPosition(address, address, int24, int24, int128, bytes) external virtual returns (bytes4, uint24)
```
**Selector**: `0x5e2411b2`



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
function afterModifyPosition(address, address, int24, int24, int128, uint256, uint256, bytes) external virtual returns (bytes4)
```
**Selector**: `0xd6852010`



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
function beforeSwap(address, address, bool, int256, uint160, bool, bytes) external virtual returns (bytes4, uint24, uint24)
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
function afterSwap(address, address, bool, int256, uint160, int256, int256, bytes) external virtual returns (bytes4)
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
function beforeFlash(address, address, uint256, uint256, bytes) external virtual returns (bytes4)
```
**Selector**: `0x8de0a8ee`



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
function afterFlash(address, address, uint256, uint256, uint256, uint256, bytes) external virtual returns (bytes4)
```
**Selector**: `0x343d37ff`



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

