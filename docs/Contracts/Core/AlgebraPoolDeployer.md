

# AlgebraPoolDeployer


Algebra pool deployer

Is used by AlgebraFactory to deploy pools

*Developer note: Version: Algebra Integral*

**Inherits:** [IAlgebraPoolDeployer](interfaces/IAlgebraPoolDeployer.md)

## Functions
### constructor

```solidity
constructor(address _factory, address _communityVault) public
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| _factory | address |  |
| _communityVault | address |  |

### getDeployParameters

```solidity
function getDeployParameters() external view returns (address _plugin, address _factory, address _communityVault, address _token0, address _token1)
```
**Selector**: `0x04889e26`

Get the parameters to be used in constructing the pool, set transiently during pool creation.

*Developer note: Called by the pool constructor to fetch the parameters of the pool*

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _plugin | address |  |
| _factory | address |  |
| _communityVault | address |  |
| _token0 | address |  |
| _token1 | address |  |

### deploy

```solidity
function deploy(address plugin, address token0, address token1) external returns (address pool)
```
**Selector**: `0xd9181cd3`



*Developer note: Deploys a pool with the given parameters by transiently setting the parameters in cache.*

| Name | Type | Description |
| ---- | ---- | ----------- |
| plugin | address | The pool associated plugin (if any) |
| token0 | address | The first token of the pool by address sort order |
| token1 | address | The second token of the pool by address sort order |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The deployed pool's address |

