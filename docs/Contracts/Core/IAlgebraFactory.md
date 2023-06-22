

# IAlgebraFactory


The interface for the Algebra Factory



*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces*


## Events
### Owner


`event Owner(address newOwner)`  

Emitted when the owner of the factory is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| newOwner | address | The owner after the owner was changed |


### VaultAddress


`event VaultAddress(address newVaultAddress)`  

Emitted when the vault address is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| newVaultAddress | address | The vault address after the address was changed |


### Pool


`event Pool(address token0, address token1, address pool)`  

Emitted when a pool is created



| Name | Type | Description |
| ---- | ---- | ----------- |
| token0 | address | The first token of the pool by address sort order |
| token1 | address | The second token of the pool by address sort order |
| pool | address | The address of the created pool |


### FarmingAddress


`event FarmingAddress(address newFarmingAddress)`  

Emitted when the farming address is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| newFarmingAddress | address | The farming address after the address was changed |


### DefaultCommunityFee


`event DefaultCommunityFee(uint8 newDefaultCommunityFee)`  

Emitted when the default community fee is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| newDefaultCommunityFee | uint8 | The new default community fee value |


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

Returns the current owner of the factory
*Developer note: Can be changed by the current owner via setOwner*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The address of the factory owner |

### poolDeployer


`function poolDeployer() external view returns (address)` view external

Returns the current poolDeployerAddress




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

### defaultCommunityFee


`function defaultCommunityFee() external view returns (uint8)` view external

Returns the default community fee




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint8 | Fee which will be set at the creation of the pool |

### vaultAddress


`function vaultAddress() external view returns (address)` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

### poolByPair


`function poolByPair(address tokenA, address tokenB) external view returns (address pool)` view external

Returns the pool address for a given pair of tokens and a fee, or address 0 if it does not exist
*Developer note: tokenA and tokenB may be passed in either token0/token1 or token1/token0 order*



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenA | address | The contract address of either token0 or token1 |
| tokenB | address | The contract address of the other token |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The pool address |

### createPool


`function createPool(address tokenA, address tokenB) external returns (address pool)`  external

Creates a pool for the given two tokens and fee
*Developer note: tokenA and tokenB may be passed in either order: token0/token1 or token1/token0. tickSpacing is retrieved
from the fee. The call will revert if the pool already exists, the fee is invalid, or the token arguments
are invalid.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenA | address | One of the two tokens in the desired pool |
| tokenB | address | The other of the two tokens in the desired pool |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The address of the newly created pool |

### setOwner


`function setOwner(address _owner) external`  external

Updates the owner of the factory
*Developer note: Must be called by the current owner*



| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | The new owner of the factory |


### setFarmingAddress


`function setFarmingAddress(address _farmingAddress) external`  external


*Developer note: updates tokenomics address on the factory*



| Name | Type | Description |
| ---- | ---- | ----------- |
| _farmingAddress | address | The new tokenomics contract address |


### setDefaultCommunityFee


`function setDefaultCommunityFee(uint8 newDefaultCommunityFee) external`  external


*Developer note: updates default community fee for new pools*



| Name | Type | Description |
| ---- | ---- | ----------- |
| newDefaultCommunityFee | uint8 | The new community fee, _must_ be &lt;&#x3D; MAX_COMMUNITY_FEE |


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





