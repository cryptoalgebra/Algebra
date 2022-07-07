

# IAlgebraFactory

The interface for the Algebra Factory



## Events
### Owner


`Owner(address)`  

Emitted when the owner of the factory is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| newOwner | address | The owner after the owner was changed |


### VaultAddress


`VaultAddress(address)`  

Emitted when the vault address is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| newVaultAddress | address | The vault address after the address was changed |


### Pool


`Pool(address,address,address)`  

Emitted when a pool is created



| Name | Type | Description |
| ---- | ---- | ----------- |
| token0 | address | The first token of the pool by address sort order |
| token1 | address | The second token of the pool by address sort order |
| pool | address | The address of the created pool |


### FarmingAddress


`FarmingAddress(address)`  

Emitted when the farming address is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| newFarmingAddress | address | The farming address after the address was changed |


### FeeConfiguration


`FeeConfiguration(uint16,uint16,uint32,uint32,uint16,uint16,uint32,uint16,uint16)`  





| Name | Type | Description |
| ---- | ---- | ----------- |
| alpha1 | uint16 |  |
| alpha2 | uint16 |  |
| beta1 | uint32 |  |
| beta2 | uint32 |  |
| gamma1 | uint16 |  |
| gamma2 | uint16 |  |
| volumeBeta | uint32 |  |
| volumeGamma | uint16 |  |
| baseFee | uint16 |  |




## Functions
### owner


`owner()` view external

Returns the current owner of the factory




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

### poolDeployer


`poolDeployer()` view external

Returns the current poolDeployerAddress




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

### farmingAddress


`farmingAddress()` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

### vaultAddress


`vaultAddress()` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

### poolByPair


`poolByPair(address,address)` view external

Returns the pool address for a given pair of tokens and a fee, or address 0 if it does not exist



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenA | address | The contract address of either token0 or token1 |
| tokenB | address | The contract address of the other token |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address |  |

### createPool


`createPool(address,address)`  external

Creates a pool for the given two tokens and fee



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenA | address | One of the two tokens in the desired pool |
| tokenB | address | The other of the two tokens in the desired pool |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address |  |

### setOwner


`setOwner(address)`  external

Updates the owner of the factory



| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | The new owner of the factory |


### setFarmingAddress


`setFarmingAddress(address)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _farmingAddress | address | The new tokenomics contract address |


### setVaultAddress


`setVaultAddress(address)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _vaultAddress | address | The new vault contract address |


### setBaseFeeConfiguration


`setBaseFeeConfiguration(uint16,uint16,uint32,uint32,uint16,uint16,uint32,uint16,uint16)`  external

Changes initial fee configuration for new pools



| Name | Type | Description |
| ---- | ---- | ----------- |
| alpha1 | uint16 | max value of the first sigmoid |
| alpha2 | uint16 | max value of the second sigmoid |
| beta1 | uint32 | shift along the x-axis for the first sigmoid |
| beta2 | uint32 | shift along the x-axis for the second sigmoid |
| gamma1 | uint16 | horizontal stretch factor for the first sigmoid |
| gamma2 | uint16 | horizontal stretch factor for the second sigmoid |
| volumeBeta | uint32 | shift along the x-axis for the outer volume-sigmoid |
| volumeGamma | uint16 | horizontal stretch factor the outer volume-sigmoid |
| baseFee | uint16 | minimum possible fee |




---


