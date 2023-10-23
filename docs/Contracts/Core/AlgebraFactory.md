

# AlgebraFactory


Algebra factory

Is used to deploy pools and its plugins

*Developer note: Version: Algebra Integral*

**Inherits:** [IAlgebraFactory](interfaces/IAlgebraFactory.md) [Ownable2Step](https://docs.openzeppelin.com/contracts/4.x/) [AccessControlEnumerable](https://docs.openzeppelin.com/contracts/4.x/)

## Public variables
### POOLS_ADMINISTRATOR_ROLE
```solidity
bytes32 constant POOLS_ADMINISTRATOR_ROLE = 0xb73ce166ead2f8e9add217713a7989e4edfba9625f71dfd2516204bb67ad3442
```
**Selector**: `0xb500a48b`

role that can change communityFee and tickspacing in pools


### poolDeployer
```solidity
address immutable poolDeployer
```
**Selector**: `0x3119049a`

Returns the current poolDeployerAddress


### communityVault
```solidity
address immutable communityVault
```
**Selector**: `0x53e97868`

Returns the current communityVaultAddress


### defaultCommunityFee
```solidity
uint16 defaultCommunityFee
```
**Selector**: `0x2f8a39dd`

Returns the default community fee


### defaultFee
```solidity
uint16 defaultFee
```
**Selector**: `0x5a6c72d0`

Returns the default fee


### defaultTickspacing
```solidity
int24 defaultTickspacing
```
**Selector**: `0x29bc3446`

Returns the default tickspacing


### renounceOwnershipStartTimestamp
```solidity
uint256 renounceOwnershipStartTimestamp
```
**Selector**: `0x084bfff9`




### defaultPluginFactory
```solidity
contract IAlgebraPluginFactory defaultPluginFactory
```
**Selector**: `0xd0ad2792`

Return the current pluginFactory address


### poolByPair
```solidity
mapping(address => mapping(address => address)) poolByPair
```
**Selector**: `0xd9a641e1`

Returns the pool address for a given pair of tokens, or address 0 if it does not exist

*Developer note: tokenA and tokenB may be passed in either token0/token1 or token1/token0 order*

### POOL_INIT_CODE_HASH
```solidity
bytes32 constant POOL_INIT_CODE_HASH = 0x177d5fbf994f4d130c008797563306f1a168dc689f81b2fa23b4396931014d91
```
**Selector**: `0xdc6fd8ab`

returns keccak256 of AlgebraPool init bytecode.

*Developer note: keccak256 of AlgebraPool init bytecode. Used to compute pool address deterministically*


## Functions
### constructor

```solidity
constructor(address _poolDeployer) public
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| _poolDeployer | address |  |

### owner

```solidity
function owner() public view returns (address)
```
**Selector**: `0x8da5cb5b`

Returns the current owner of the factory

*Developer note: Can be changed by the current owner via transferOwnership(address newOwner)*

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The address of the factory owner |

### hasRoleOrOwner

```solidity
function hasRoleOrOwner(bytes32 role, address account) public view returns (bool)
```
**Selector**: `0xe8ae2b69`

Returns &#x60;true&#x60; if &#x60;account&#x60; has been granted &#x60;role&#x60; or &#x60;account&#x60; is owner.

| Name | Type | Description |
| ---- | ---- | ----------- |
| role | bytes32 | The hash corresponding to the role |
| account | address | The address for which the role is checked |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | bool Whether the address has this role or the owner role or not |

### defaultConfigurationForPool

```solidity
function defaultConfigurationForPool() external view returns (uint16 communityFee, int24 tickSpacing, uint16 fee)
```
**Selector**: `0x25b355d6`

Returns the default communityFee and tickspacing

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| communityFee | uint16 | which will be set at the creation of the pool |
| tickSpacing | int24 | which will be set at the creation of the pool |
| fee | uint16 | which will be set at the creation of the pool |

### computePoolAddress

```solidity
function computePoolAddress(address token0, address token1) public view returns (address pool)
```
**Selector**: `0xd8ed2241`

Deterministically computes the pool address given the token0 and token1

*Developer note: The method does not check if such a pool has been created*

| Name | Type | Description |
| ---- | ---- | ----------- |
| token0 | address | first token |
| token1 | address | second token |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The contract address of the Algebra pool |

### createPool

```solidity
function createPool(address tokenA, address tokenB) external returns (address pool)
```
**Selector**: `0xe3433615`

Creates a pool for the given two tokens

*Developer note: tokenA and tokenB may be passed in either order: token0/token1 or token1/token0.
The call will revert if the pool already exists or the token arguments are invalid.*

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenA | address | One of the two tokens in the desired pool |
| tokenB | address | The other of the two tokens in the desired pool |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The address of the newly created pool |

### setDefaultCommunityFee

```solidity
function setDefaultCommunityFee(uint16 newDefaultCommunityFee) external
```
**Selector**: `0x8d5a8711`



*Developer note: updates default community fee for new pools*

| Name | Type | Description |
| ---- | ---- | ----------- |
| newDefaultCommunityFee | uint16 | The new community fee, _must_ be <= MAX_COMMUNITY_FEE |

### setDefaultFee

```solidity
function setDefaultFee(uint16 newDefaultFee) external
```
**Selector**: `0x77326584`



*Developer note: updates default fee for new pools*

| Name | Type | Description |
| ---- | ---- | ----------- |
| newDefaultFee | uint16 | The new fee, _must_ be <= MAX_DEFAULT_FEE |

### setDefaultTickspacing

```solidity
function setDefaultTickspacing(int24 newDefaultTickspacing) external
```
**Selector**: `0xf09489ac`



*Developer note: updates default tickspacing for new pools*

| Name | Type | Description |
| ---- | ---- | ----------- |
| newDefaultTickspacing | int24 | The new tickspacing, _must_ be <= MAX_TICK_SPACING and >= MIN_TICK_SPACING |

### setDefaultPluginFactory

```solidity
function setDefaultPluginFactory(address newDefaultPluginFactory) external
```
**Selector**: `0x2939dd97`



*Developer note: updates pluginFactory address*

| Name | Type | Description |
| ---- | ---- | ----------- |
| newDefaultPluginFactory | address | address of new plugin factory |

### startRenounceOwnership

```solidity
function startRenounceOwnership() external
```
**Selector**: `0x469388c4`

Starts process of renounceOwnership. After that, a certain period
of time must pass before the ownership renounce can be completed.

### stopRenounceOwnership

```solidity
function stopRenounceOwnership() external
```
**Selector**: `0x238a1d74`

Stops process of renounceOwnership and removes timer.

### renounceOwnership

```solidity
function renounceOwnership() public
```
**Selector**: `0x715018a6`



*Developer note: Leaves the contract without owner. It will not be possible to call &#x60;onlyOwner&#x60; functions anymore.
Can only be called by the current owner if RENOUNCE_OWNERSHIP_DELAY seconds
have passed since the call to the startRenounceOwnership() function.*

