

# AlgebraFactory


Algebra factory

Is used to deploy pools and its dataStorages

*Developer note: Version: Algebra V1.9*

## Modifiers
### onlyOwner


`modifier onlyOwner()`  internal









## Variables
### address owner 

Returns the current owner of the factory

*Developer note: Can be changed by the current owner via setOwner*
### address poolDeployer immutable

Returns the current poolDeployerAddress

### address farmingAddress 



*Developer note: Is retrieved from the pools to restrict calling
certain functions not by a tokenomics contract*
### address vaultAddress 



### struct AdaptiveFee.Configuration baseFeeConfiguration 



### mapping(address &#x3D;&gt; mapping(address &#x3D;&gt; address)) poolByPair 

Returns the pool address for a given pair of tokens and a fee, or address 0 if it does not exist

*Developer note: tokenA and tokenB may be passed in either token0/token1 or token1/token0 order*

## Functions
### constructor


`constructor(address _poolDeployer, address _vaultAddress) public`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _poolDeployer | address |  |
| _vaultAddress | address |  |


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





