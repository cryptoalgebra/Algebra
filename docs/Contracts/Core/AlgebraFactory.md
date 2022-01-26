

# AlgebraFactory

## Modifiers
### onlyOwner











## Variables
### bool isPaused 



### bool isPauseForbidden 



### address owner 

Returns the current owner of the factory

*Developer note: Can be changed by the current owner via setOwner*
### address poolDeployer 

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
| _vaultAddress | address |  |


### setBaseFeeConfiguration

onlyOwner

`setBaseFeeConfiguration(uint32,uint32,uint32,uint32,uint16,uint16,uint32,uint32,uint16)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| alpha1 | uint32 |  |
| alpha2 | uint32 |  |
| beta1 | uint32 |  |
| beta2 | uint32 |  |
| gamma1 | uint16 |  |
| gamma2 | uint16 |  |
| volumeBeta | uint32 |  |
| volumeGamma | uint32 |  |
| baseFee | uint16 |  |


### pause

onlyOwner

`pause()`  external







### unpause

onlyOwner

`unpause()`  external







### forbidPause

onlyOwner

`forbidPause()`  external









---


