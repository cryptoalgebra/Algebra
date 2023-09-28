

# BasePluginV1Factory


Algebra default plugin factory

This contract creates Algebra default plugins for Algebra liquidity pools

**Inherits:** [IBasePluginV1Factory](interfaces/IBasePluginV1Factory.md)
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


### defaultFeeConfiguration
```solidity
struct AlgebraFeeConfiguration defaultFeeConfiguration
```
**Selector**: `0x4e09a96a`

Current default dynamic fee configuration

*Developer note: See the AdaptiveFee struct for more details about params.
This value is set by default in new plugins*

### farmingAddress
```solidity
address farmingAddress
```
**Selector**: `0x8a2ade58`

Returns current farming address


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

### createPlugin

```solidity
function createPlugin(address pool) external returns (address)
```
**Selector**: `0x361c0f76`

Deploys new plugin contract for pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The address of the pool for which the new plugin will be created |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | New plugin address |

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

