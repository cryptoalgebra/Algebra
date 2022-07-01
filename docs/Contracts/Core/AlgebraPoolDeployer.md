

# AlgebraPoolDeployer




## Modifiers
### onlyFactory









### onlyOwner











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


`constructor()`  public







### setFactory

onlyOwner

`setFactory(address)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _factory | address |  |


### deploy

onlyFactory

`deploy(address,address,address,address)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| dataStorage | address | The pools associated dataStorage |
| _factory | address |  |
| token0 | address | The first token of the pool by address sort order |
| token1 | address | The second token of the pool by address sort order |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address |  |



---


