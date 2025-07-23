

# BasePluginFactory






**Inherits:** [IBasePluginFactory](../interfaces/IBasePluginFactory.md)

## Public variables
### entryPoint
```solidity
address immutable entryPoint
```
**Selector**: `0xb0d691fe`

Returns the address of AlgebraCustomPoolEntryPoint

*Developer note: This is a main entry point for creating, managing plugins*


## Functions
### createCustomPool

```solidity
function createCustomPool(address creator, address tokenA, address tokenB, bytes data) external virtual returns (address customPool)
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

### beforeCreatePoolHook

```solidity
function beforeCreatePoolHook(address pool, address, address, address, address, bytes) external virtual returns (address)
```
**Selector**: `0x1d0338d9`

Deploys new plugin contract for pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The address of the new pool |
|  | address |  |
|  | address |  |
|  | address |  |
|  | address |  |
|  | bytes |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | New plugin address |

### afterCreatePoolHook

```solidity
function afterCreatePoolHook(address, address, address) external view virtual
```
**Selector**: `0x8d5ef8d1`

Called after the pool is created

| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |
|  | address |  |
|  | address |  |

