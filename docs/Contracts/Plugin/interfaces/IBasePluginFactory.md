

# IBasePluginFactory


The interface for the BasePluginFactory



**Inherits:** [IAlgebraPluginFactory](../../Core/interfaces/plugin/IAlgebraPluginFactory.md)

## Functions
### entryPoint

```solidity
function entryPoint() external view returns (address)
```
**Selector**: `0xb0d691fe`

Returns the address of AlgebraCustomPoolEntryPoint

*Developer note: This is a main entry point for creating, managing plugins*

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The AlgebraCustomPoolEntryPoint contract address |

### createCustomPool

```solidity
function createCustomPool(address creator, address tokenA, address tokenB, bytes data) external returns (address customPool)
```
**Selector**: `0x819dbd89`

Create a custom pool with a plugin

| Name | Type | Description |
| ---- | ---- | ----------- |
| creator | address | The address that initiated the pool creation |
| tokenA | address | The address of first token in pool |
| tokenB | address | The address of second token in pool |
| data | bytes | The data to be passed to beforeCreatePoolHook |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| customPool | address | The address of created plugin |

### setTickSpacing

```solidity
function setTickSpacing(address pool, int24 newTickSpacing) external
```
**Selector**: `0x4bf092cd`

Sets tick spacing in a deployed custom pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The address of custom pool |
| newTickSpacing | int24 | The new tick spacing |

### setPlugin

```solidity
function setPlugin(address pool, address newPluginAddress) external
```
**Selector**: `0xf9f4c09a`

Sets plugin in a deployed custom pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The address of custom pool |
| newPluginAddress | address | The new plugin |

### setPluginConfig

```solidity
function setPluginConfig(address pool, uint8 newConfig) external
```
**Selector**: `0x054bee3d`

Sets plugin config in a deployed custom pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The address of custom pool |
| newConfig | uint8 | The new config |

### setFee

```solidity
function setFee(address pool, uint16 newFee) external
```
**Selector**: `0x337f3a31`

Sets fee in a deployed custom pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The address of custom pool |
| newFee | uint16 | The new fee |

