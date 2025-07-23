

# ISecurityPluginFactory


The interface for the SecurityPluginFactory



**Inherits:** [IAlgebraPluginFactory](../../Core/interfaces/plugin/IAlgebraPluginFactory.md)

## Events
### SecurityRegistry

```solidity
event SecurityRegistry(address securityRegistry)
```

Emitted when the security registry address is changed

| Name | Type | Description |
| ---- | ---- | ----------- |
| securityRegistry | address | The security registry address after the address was changed |


## Functions
### ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR

```solidity
function ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR() external pure returns (bytes32)
```
**Selector**: `0xcddff269`

The hash of &#x27;ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR&#x27; used as role

*Developer note: allows to change settings of BasePluginV1Factory*

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32 |  |

### algebraFactory

```solidity
function algebraFactory() external view returns (address)
```
**Selector**: `0xa7b64b04`

Returns the address of AlgebraFactory

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The AlgebraFactory contract address |

### securityRegistry

```solidity
function securityRegistry() external view returns (address)
```
**Selector**: `0x9b21f9ae`

Returns current securityRegistry address

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The securityRegistry contract address |

### pluginByPool

```solidity
function pluginByPool(address pool) external view returns (address)
```
**Selector**: `0xcdef16f6`

Returns address of plugin created for given AlgebraPool

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The address of AlgebraPool |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The address of corresponding plugin |

### createPluginForExistingPool

```solidity
function createPluginForExistingPool(address token0, address token1) external returns (address)
```
**Selector**: `0x27733026`

Create plugin for already existing pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| token0 | address | The address of first token in pool |
| token1 | address | The address of second token in pool |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The address of created plugin |

### setSecurityRegistry

```solidity
function setSecurityRegistry(address newSecurityRegistry) external
```
**Selector**: `0x64fae8a9`



*Developer note: updates securoty registry address on the factory*

| Name | Type | Description |
| ---- | ---- | ----------- |
| newSecurityRegistry | address | The new security registry contract address |

