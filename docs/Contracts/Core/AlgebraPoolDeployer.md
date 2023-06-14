

# AlgebraPoolDeployer


Algebra pool deployer

Is used by AlgebraFactory to deploy pools

*Developer note: Version: Algebra V1.9*

## Modifiers
### onlyFactory


`modifier onlyFactory()`  internal







### onlyOwner


`modifier onlyOwner()`  internal









## Variables
### struct AlgebraPoolDeployer.Parameters parameters 

Get the parameters to be used in constructing the pool, set transiently during pool creation.

*Developer note: Called by the pool constructor to fetch the parameters of the pool
Returns dataStorage The pools associated dataStorage
Returns factory The factory address
Returns token0 The first token of the pool by address sort order
Returns token1 The second token of the pool by address sort order*

## Functions
### constructor


`constructor() public`  public







### setFactory


`function setFactory(address _factory) external`  external


*Developer note: Sets the factory address to the poolDeployer for permissioned actions*



| Name | Type | Description |
| ---- | ---- | ----------- |
| _factory | address |  |


### deploy


`function deploy(address dataStorage, address _factory, address token0, address token1) external returns (address pool)`  external


*Developer note: Deploys a pool with the given parameters by transiently setting the parameters storage slot and then
clearing it after deploying the pool.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| dataStorage | address | The pools associated dataStorage |
| _factory | address |  |
| token0 | address | The first token of the pool by address sort order |
| token1 | address | The second token of the pool by address sort order |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The deployed pool&#x27;s address |




