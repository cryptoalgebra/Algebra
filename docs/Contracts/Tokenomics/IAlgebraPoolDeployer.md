

# IAlgebraPoolDeployer


## Events
### FactoryChanged


`FactoryChanged(address,address)`  

Emitted when the factory address is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| factory | address | The factory address before the address was changed |
| _factory | address | The factory address after the address was changed |




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


