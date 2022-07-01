

# IAlgebraPoolDeployer

An interface for a contract that is capable of deploying Algebra Pools
A contract that constructs a pool must implement this to pass arguments to the pool
*Developer note: This is used to avoid having constructor arguments in the pool contract, which results in the init code hash
of the pool being constant allowing the CREATE2 address of the pool to be cheaply computed on-chain*


## Events
### Factory


`Factory(address)`  

Emitted when the factory address is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| factory | address | The factory address after the address was changed |




## Functions
### parameters


`parameters()` view external

Get the parameters to be used in constructing the pool, set transiently during pool creation.




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| dataStorage | address |  |
| factory | address |  |
| token0 | address |  |
| token1 | address |  |

### deploy


`deploy(address,address,address,address)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| dataStorage | address | The pools associated dataStorage |
| factory | address | The contract address of the Algebra factory |
| token0 | address | The first token of the pool by address sort order |
| token1 | address | The second token of the pool by address sort order |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address |  |

### setFactory


`setFactory(address)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| factory | address | The address of the Algebra factory |




---


