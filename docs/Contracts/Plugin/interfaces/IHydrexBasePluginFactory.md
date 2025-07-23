

# IHydrexBasePluginFactory


The interface for the HydrexBasePluginFactory

This contract creates Algebra base plugins for Algebra liquidity pools

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

### DefaultBaseFee

```solidity
event DefaultBaseFee(uint16 newDefaultBaseFee)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| newDefaultBaseFee | uint16 |  |

### DynamicFeeStatus

```solidity
event DynamicFeeStatus(bool isEnabled)
```

Emitted when the dynamic fee status is changed

| Name | Type | Description |
| ---- | ---- | ----------- |
| isEnabled | bool | Dynamic fee new status |

### SlidingFeeStatus

```solidity
event SlidingFeeStatus(bool isEnabled)
```

Emitted when the sliding fee status is changed

| Name | Type | Description |
| ---- | ---- | ----------- |
| isEnabled | bool | Sliding fee new status |

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

### defaultBaseFee

```solidity
function defaultBaseFee() external view returns (uint16)
```
**Selector**: `0x675ec3d7`



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint16 |  |

### slidingFeeStatus

```solidity
function slidingFeeStatus() external view returns (bool)
```
**Selector**: `0xeb7bfd70`

Returns the status of the sliding fee

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | The status of the sliding fee |

### dynamicFeeStatus

```solidity
function dynamicFeeStatus() external view returns (bool)
```
**Selector**: `0xb7c53e79`

Returns the status of the dynamic fee

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | The status of the dynamic fee |

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

### setDynamicFeeStatus

```solidity
function setDynamicFeeStatus(bool status) external
```
**Selector**: `0x141773b3`

Changes dynamic fee status

| Name | Type | Description |
| ---- | ---- | ----------- |
| status | bool | New status of dynamic fee |

### setSlidingFeeStatus

```solidity
function setSlidingFeeStatus(bool status) external
```
**Selector**: `0x03801165`

Changes sliding fee status

| Name | Type | Description |
| ---- | ---- | ----------- |
| status | bool | New status of sliding fee |

### setSecurityRegistry

```solidity
function setSecurityRegistry(address newSecurityRegistry) external
```
**Selector**: `0x64fae8a9`



*Developer note: updates securoty registry address on the factory*

| Name | Type | Description |
| ---- | ---- | ----------- |
| newSecurityRegistry | address | The new security registry contract address |

### setDefaultBaseFee

```solidity
function setDefaultBaseFee(uint16 newDefaultBaseFee) external
```
**Selector**: `0x0bc614c4`



| Name | Type | Description |
| ---- | ---- | ----------- |
| newDefaultBaseFee | uint16 |  |

