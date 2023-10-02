

# IBasePluginV1Factory


The interface for the BasePluginV1Factory

This contract creates Algebra default plugins for Algebra liquidity pools

**Inherits:** [IAlgebraPluginFactory](../../Core/interfaces/plugin/IAlgebraPluginFactory.md)

## Events
### DefaultFeeConfiguration

```solidity
event DefaultFeeConfiguration(struct AlgebraFeeConfiguration newConfig)
```

Emitted when the default fee configuration is changed

*Developer note: See the AdaptiveFee library for more details*

| Name | Type | Description |
| ---- | ---- | ----------- |
| newConfig | struct AlgebraFeeConfiguration | The structure with dynamic fee parameters |

### FarmingAddress

```solidity
event FarmingAddress(address newFarmingAddress)
```

Emitted when the farming address is changed

| Name | Type | Description |
| ---- | ---- | ----------- |
| newFarmingAddress | address | The farming address after the address was changed |


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

### defaultFeeConfiguration

```solidity
function defaultFeeConfiguration() external view returns (uint16 alpha1, uint16 alpha2, uint32 beta1, uint32 beta2, uint16 gamma1, uint16 gamma2, uint16 baseFee)
```
**Selector**: `0x4e09a96a`

Current default dynamic fee configuration

*Developer note: See the AdaptiveFee struct for more details about params.
This value is set by default in new plugins*

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

### setDefaultFeeConfiguration

```solidity
function setDefaultFeeConfiguration(struct AlgebraFeeConfiguration newConfig) external
```
**Selector**: `0xf718949a`

Changes initial fee configuration for new pools

*Developer note: changes coefficients for sigmoids: α / (1 + e^( (β-x) / γ))
alpha1 + alpha2 + baseFee (max possible fee) must be &lt;&#x3D; type(uint16).max and gammas must be &gt; 0*

| Name | Type | Description |
| ---- | ---- | ----------- |
| newConfig | struct AlgebraFeeConfiguration | new default fee configuration. See the #AdaptiveFee.sol library for details |

### setFarmingAddress

```solidity
function setFarmingAddress(address newFarmingAddress) external
```
**Selector**: `0xb001f618`



*Developer note: updates farmings manager address on the factory*

| Name | Type | Description |
| ---- | ---- | ----------- |
| newFarmingAddress | address | The new tokenomics contract address |

