

# AlgebraFactory

Algebra factory
Is used to deploy pools and its dataStorages

## Modifiers
### onlyOwner











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


`constructor(address,address)`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _poolDeployer | address |  |
| _vaultAddress | address |  |


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

onlyOwner

`setOwner(address)`  external

Updates the owner of the factory



| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | The new owner of the factory |


### setFarmingAddress

onlyOwner

`setFarmingAddress(address)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _farmingAddress | address | The new tokenomics contract address |


### setVaultAddress

onlyOwner

`setVaultAddress(address)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _vaultAddress | address | The new vault contract address |


### setBaseFeeConfiguration

onlyOwner

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


