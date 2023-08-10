

# IDataStorageFactory


The interface for the DataStorageFactory

TODO


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
### farmingAddress


```solidity
function farmingAddress() external view returns (address)
```



*Developer note: Is retrieved from the pools to restrict calling certain functions not by a tokenomics contract*

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The tokenomics contract address |

### pluginByPool


```solidity
function pluginByPool(address pool) external view returns (address)
```

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



*Developer note: updates farmings manager address on the factory*

| Name | Type | Description |
| ---- | ---- | ----------- |
| newFarmingAddress | address | The new tokenomics contract address |

