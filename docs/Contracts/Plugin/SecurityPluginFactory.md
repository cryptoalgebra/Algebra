

# SecurityPluginFactory


Algebra Integral 1.2.1 security plugin factory



**Inherits:** [ISecurityPluginFactory](interfaces/ISecurityPluginFactory.md)
## Modifiers
### onlyAdministrator

```solidity
modifier onlyAdministrator()
```




## Public variables
### ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR
```solidity
bytes32 constant ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR = 0x267da724c255813ae00f4522fe843cb70148a4b8099cbc5af64f9a4151e55ed6
```
**Selector**: `0xcddff269`

The hash of &#x27;ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR&#x27; used as role

*Developer note: allows to change settings of BasePluginV1Factory*

### algebraFactory
```solidity
address immutable algebraFactory
```
**Selector**: `0xa7b64b04`

Returns the address of AlgebraFactory


### securityRegistry
```solidity
address securityRegistry
```
**Selector**: `0x9b21f9ae`

Returns current securityRegistry address


### pluginByPool
```solidity
mapping(address => address) pluginByPool
```
**Selector**: `0xcdef16f6`

Returns address of plugin created for given AlgebraPool



## Functions
### constructor

```solidity
constructor(address _algebraFactory) public
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| _algebraFactory | address |  |

### beforeCreatePoolHook

```solidity
function beforeCreatePoolHook(address pool, address, address, address, address, bytes) external returns (address)
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
function afterCreatePoolHook(address, address, address) external view
```
**Selector**: `0x8d5ef8d1`

Called after the pool is created

| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |
|  | address |  |
|  | address |  |

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
function setSecurityRegistry(address _securityRegistry) external
```
**Selector**: `0x64fae8a9`



*Developer note: updates securoty registry address on the factory*

| Name | Type | Description |
| ---- | ---- | ----------- |
| _securityRegistry | address |  |

