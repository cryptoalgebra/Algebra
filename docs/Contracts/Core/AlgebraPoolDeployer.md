

# AlgebraPoolDeployer


Algebra pool deployer

Is used by AlgebraFactory to deploy pools

*Developer note: Version: Algebra V2.1*




## Functions
### constructor


`constructor(address _factory, address _communityVault) public`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _factory | address |  |
| _communityVault | address |  |


### getDeployParameters


`function getDeployParameters() external view returns (address _dataStorage, address _factory, address _communityVault, address _token0, address _token1)` view external

Get the parameters to be used in constructing the pool, set transiently during pool creation.
*Developer note: Called by the pool constructor to fetch the parameters of the pool*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _dataStorage | address |  |
| _factory | address |  |
| _communityVault | address |  |
| _token0 | address |  |
| _token1 | address |  |

### deploy


`function deploy(address dataStorage, address token0, address token1) external returns (address pool)`  external


*Developer note: Deploys a pool with the given parameters by transiently setting the parameters in cache.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| dataStorage | address | The pools associated dataStorage |
| token0 | address | The first token of the pool by address sort order |
| token1 | address | The second token of the pool by address sort order |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The deployed pool&#x27;s address |




