

# AlgebraVaultFactoryStub


Algebra vault factory stub

This contract is used to set AlgebraCommunityVault as communityVault in new pools

**Inherits:** [IAlgebraVaultFactory](interfaces/vault/IAlgebraVaultFactory.md)

## Public variables
### defaultAlgebraCommunityVault
```solidity
address immutable defaultAlgebraCommunityVault
```
**Selector**: `0xb7a85452`

the address of AlgebraCommunityVault



## Functions
### constructor

```solidity
constructor(address _algebraCommunityVault) public
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| _algebraCommunityVault | address |  |

### getVaultForPool

```solidity
function getVaultForPool(address) external view returns (address)
```
**Selector**: `0x7570e389`

returns address of the community fee vault for the pool

| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

### createVaultForPool

```solidity
function createVaultForPool(address, address, address, address, address) external view returns (address)
```
**Selector**: `0xb8a1d3c6`

creates the community fee vault for the pool if needed

| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |
|  | address |  |
|  | address |  |
|  | address |  |
|  | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

