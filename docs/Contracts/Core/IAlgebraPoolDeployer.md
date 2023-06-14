

# IAlgebraPoolDeployer


An interface for a contract that is capable of deploying Algebra Pools

A contract that constructs a pool must implement this to pass arguments to the pool

*Developer note: This is used to avoid having constructor arguments in the pool contract, which results in the init code hash
of the pool being constant allowing the CREATE2 address of the pool to be cheaply computed on-chain.
Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces*


## Events
### Factory


`event Factory(address factory)`  

Emitted when the factory address is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| factory | address | The factory address after the address was changed |




## Functions
### parameters


`function parameters() external view returns (address dataStorage, address factory, address token0, address token1)` view external

Get the parameters to be used in constructing the pool, set transiently during pool creation.
*Developer note: Called by the pool constructor to fetch the parameters of the pool
Returns dataStorage The pools associated dataStorage
Returns factory The factory address
Returns token0 The first token of the pool by address sort order
Returns token1 The second token of the pool by address sort order*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| dataStorage | address |  |
| factory | address |  |
| token0 | address |  |
| token1 | address |  |

### deploy


`function deploy(address dataStorage, address factory, address token0, address token1) external returns (address pool)`  external


*Developer note: Deploys a pool with the given parameters by transiently setting the parameters storage slot and then
clearing it after deploying the pool.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| dataStorage | address | The pools associated dataStorage |
| factory | address | The contract address of the Algebra factory |
| token0 | address | The first token of the pool by address sort order |
| token1 | address | The second token of the pool by address sort order |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The deployed pool&#x27;s address |

### setFactory


`function setFactory(address factory) external`  external


*Developer note: Sets the factory address to the poolDeployer for permissioned actions*



| Name | Type | Description |
| ---- | ---- | ----------- |
| factory | address | The address of the Algebra factory |





