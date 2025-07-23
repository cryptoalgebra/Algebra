

# IBasePluginV2Factory


The interface for the BasePluginV2Factory

This contract creates Algebra default plugins for Algebra liquidity pools

**Inherits:** [IAlgebraPluginFactory](../../Core/interfaces/plugin/IAlgebraPluginFactory.md)

## Events
### FarmingAddress

```solidity
event FarmingAddress(address newFarmingAddress)
```

Emitted when the farming address is changed

| Name | Type | Description |
| ---- | ---- | ----------- |
| newFarmingAddress | address | The farming address after the address was changed |

### DefaultBaseFee

```solidity
event DefaultBaseFee(uint16 newDefaultBaseFee)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| newDefaultBaseFee | uint16 |  |


## Functions
### ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR

```solidity
function ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR() external pure returns (bytes32)
```
**Selector**: `0xcddff269`

The hash of &#x27;ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR&#x27; used as role

*Developer note: allows to change settings of BasePluginV2Factory*

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

### farmingAddress

```solidity
function farmingAddress() external view returns (address)
```
**Selector**: `0x8a2ade58`

Returns current farming address

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The farming contract address |

### defaultBaseFee

```solidity
function defaultBaseFee() external view returns (uint16)
```
**Selector**: `0x675ec3d7`



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint16 |  |

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

