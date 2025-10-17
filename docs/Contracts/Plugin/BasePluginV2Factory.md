

# BasePluginV2Factory


Algebra Integral 1.2.2 default plugin factory

This contract creates Algebra sliding fee plugins for Algebra liquidity pools

*Developer note: This plugin factory can only be used for Algebra base pools*

**Inherits:** [IBasePluginV2Factory](interfaces/IBasePluginV2Factory.md)
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

*Developer note: allows to change settings of BasePluginV2Factory*

### algebraFactory
```solidity
address immutable algebraFactory
```
**Selector**: `0xa7b64b04`

Returns the address of AlgebraFactory


### farmingAddress
```solidity
address farmingAddress
```
**Selector**: `0x8a2ade58`

Returns current farming address


### defaultBaseFee
```solidity
uint16 defaultBaseFee
```
**Selector**: `0x675ec3d7`




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

### setFarmingAddress

```solidity
function setFarmingAddress(address newFarmingAddress) external
```
**Selector**: `0xb001f618`



*Developer note: updates farmings manager address on the factory*

| Name | Type | Description |
| ---- | ---- | ----------- |
| newFarmingAddress | address | The new tokenomics contract address |

### setDefaultBaseFee

```solidity
function setDefaultBaseFee(uint16 newDefaultBaseFee) external
```
**Selector**: `0x0bc614c4`



| Name | Type | Description |
| ---- | ---- | ----------- |
| newDefaultBaseFee | uint16 |  |

