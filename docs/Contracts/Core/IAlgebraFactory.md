

# IAlgebraFactory


The interface for the Algebra Factory



*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces*


## Events
### Owner


`event Owner(address newOwner)`  

@notice Emitted when the owner of the factory is changed
 @param newOwner The owner after the owner was changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| newOwner | address |  |


### VaultAddress


`event VaultAddress(address newVaultAddress)`  

@notice Emitted when the vault address is changed
 @param newVaultAddress The vault address after the address was changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| newVaultAddress | address |  |


### Pool


`event Pool(address token0, address token1, address pool)`  

@notice Emitted when a pool is created
 @param token0 The first token of the pool by address sort order
 @param token1 The second token of the pool by address sort order
 @param pool The address of the created pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| token0 | address |  |
| token1 | address |  |
| pool | address |  |


### FarmingAddress


`event FarmingAddress(address newFarmingAddress)`  

@notice Emitted when the farming address is changed
 @param newFarmingAddress The farming address after the address was changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| newFarmingAddress | address |  |


### FeeConfiguration


`event FeeConfiguration(uint16 alpha1, uint16 alpha2, uint32 beta1, uint32 beta2, uint16 gamma1, uint16 gamma2, uint32 volumeBeta, uint16 volumeGamma, uint16 baseFee)`  





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


`function owner() external view returns (address)` view external

@notice Returns the current owner of the factory
 @dev Can be changed by the current owner via setOwner
 @return The address of the factory owner




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The address of the factory owner |

### poolDeployer


`function poolDeployer() external view returns (address)` view external

@notice Returns the current poolDeployerAddress
 @return The address of the poolDeployer




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The address of the poolDeployer |

### farmingAddress


`function farmingAddress() external view returns (address)` view external


*Developer note: Is retrieved from the pools to restrict calling
certain functions not by a tokenomics contract*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The tokenomics contract address |

### vaultAddress


`function vaultAddress() external view returns (address)` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

### poolByPair


`function poolByPair(address tokenA, address tokenB) external view returns (address pool)` view external

@notice Returns the pool address for a given pair of tokens and a fee, or address 0 if it does not exist
 @dev tokenA and tokenB may be passed in either token0/token1 or token1/token0 order
 @param tokenA The contract address of either token0 or token1
 @param tokenB The contract address of the other token
 @return pool The pool address



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenA | address |  |
| tokenB | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The pool address |

### createPool


`function createPool(address tokenA, address tokenB) external returns (address pool)`  external

@notice Creates a pool for the given two tokens and fee
 @param tokenA One of the two tokens in the desired pool
 @param tokenB The other of the two tokens in the desired pool
 @dev tokenA and tokenB may be passed in either order: token0/token1 or token1/token0. tickSpacing is retrieved
 from the fee. The call will revert if the pool already exists, the fee is invalid, or the token arguments
 are invalid.
 @return pool The address of the newly created pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenA | address |  |
| tokenB | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The address of the newly created pool |

### setOwner


`function setOwner(address _owner) external`  external

@notice Updates the owner of the factory
 @dev Must be called by the current owner
 @param _owner The new owner of the factory



| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address |  |


### setFarmingAddress


`function setFarmingAddress(address _farmingAddress) external`  external


*Developer note: updates tokenomics address on the factory*



| Name | Type | Description |
| ---- | ---- | ----------- |
| _farmingAddress | address | The new tokenomics contract address |


### setVaultAddress


`function setVaultAddress(address _vaultAddress) external`  external


*Developer note: updates vault address on the factory*



| Name | Type | Description |
| ---- | ---- | ----------- |
| _vaultAddress | address | The new vault contract address |


### setBaseFeeConfiguration


`function setBaseFeeConfiguration(uint16 alpha1, uint16 alpha2, uint32 beta1, uint32 beta2, uint16 gamma1, uint16 gamma2, uint32 volumeBeta, uint16 volumeGamma, uint16 baseFee) external`  external

Changes initial fee configuration for new pools
*Developer note: changes coefficients for sigmoids: α / (1 + e^( (β-x) / γ))
alpha1 + alpha2 + baseFee (max possible fee) must be &lt;&#x3D; type(uint16).max
gammas must be &gt; 0*



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





