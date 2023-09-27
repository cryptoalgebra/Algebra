

# BasePluginV1Factory


Algebra default plugin factory

This contract creates Algebra default plugins for Algebra liquidity pools

## Modifiers
### onlyAdministrator

```solidity
modifier onlyAdministrator()
```




## Variables
### bytes32 ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR constant

The hash of &#x27;ALGEBRA_BASE_PLUGIN_FACTORY_ADMINISTRATOR&#x27; used as role

*Developer note: allows to change settings of BasePluginV1Factory*

### address algebraFactory immutable

Returns the address of AlgebraFactory


### struct AlgebraFeeConfiguration defaultFeeConfiguration 

Current default dynamic fee configuration

*Developer note: See the AdaptiveFee struct for more details about params.
This value is set by default in new plugins*

### address farmingAddress 

Returns current farming address


### mapping(address &#x3D;&gt; address) pluginByPool 

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

