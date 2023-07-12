

# AlgebraFactory


Algebra factory

Is used to deploy pools and its plugins

*Developer note: Version: Algebra Integral*



## Variables
### bytes32 POOLS_ADMINISTRATOR_ROLE constant

role that can change communityFee and tickspacing in pools

### address poolDeployer immutable

Returns the current poolDeployerAddress

### address communityVault immutable

Returns the current communityVaultAddress

### uint16 defaultCommunityFee 

Returns the default community fee

### uint16 defaultFee 

Returns the default fee

### int24 defaultTickspacing 

Returns the default tickspacing

### uint256 renounceOwnershipStartTimestamp 



### contract IAlgebraPluginFactory defaultPluginFactory 

Return the current pluginFactory address

### mapping(address &#x3D;&gt; mapping(address &#x3D;&gt; address)) poolByPair 

Returns the pool address for a given pair of tokens, or address 0 if it does not exist

*Developer note: tokenA and tokenB may be passed in either token0/token1 or token1/token0 order*

## Functions
### constructor


`constructor(address _poolDeployer) public`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _poolDeployer | address |  |


### owner


`function owner() public view returns (address)` view public

Returns the current owner of the factory
*Developer note: Can be changed by the current owner via transferOwnership(address newOwner)*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The address of the factory owner |

### hasRoleOrOwner


`function hasRoleOrOwner(bytes32 role, address account) public view returns (bool)` view public

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


`function defaultConfigurationForPool() external view returns (uint16 communityFee, int24 tickSpacing, uint16 fee)` view external

Returns the default communityFee and tickspacing




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| communityFee | uint16 | which will be set at the creation of the pool |
| tickSpacing | int24 | which will be set at the creation of the pool |
| fee | uint16 | which will be set at the creation of the pool |

### computePoolAddress


`function computePoolAddress(address token0, address token1) public view returns (address pool)` view public

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


`function createPool(address tokenA, address tokenB) external returns (address pool)`  external

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


`function setDefaultCommunityFee(uint16 newDefaultCommunityFee) external`  external


*Developer note: updates default community fee for new pools*



| Name | Type | Description |
| ---- | ---- | ----------- |
| newDefaultCommunityFee | uint16 | The new community fee, _must_ be &lt;&#x3D; MAX_COMMUNITY_FEE |


### setDefaultFee


`function setDefaultFee(uint16 newDefaultFee) external`  external


*Developer note: updates default fee for new pools*



| Name | Type | Description |
| ---- | ---- | ----------- |
| newDefaultFee | uint16 | The new  fee, _must_ be &lt;&#x3D; MAX_DEFAULT_FEE |


### setDefaultTickspacing


`function setDefaultTickspacing(int24 newDefaultTickspacing) external`  external


*Developer note: updates default tickspacing for new pools*



| Name | Type | Description |
| ---- | ---- | ----------- |
| newDefaultTickspacing | int24 | The new tickspacing, _must_ be &lt;&#x3D; MAX_TICK_SPACING and &gt;&#x3D; MIN_TICK_SPACING |


### setDefaultPluginFactory


`function setDefaultPluginFactory(address newDefaultPluginFactory) external`  external


*Developer note: updates pluginFactory address*



| Name | Type | Description |
| ---- | ---- | ----------- |
| newDefaultPluginFactory | address | address of new plugin factory |


### startRenounceOwnership


`function startRenounceOwnership() external`  external

Starts process of renounceOwnership. After that, a certain period
of time must pass before the ownership renounce can be completed.





### stopRenounceOwnership


`function stopRenounceOwnership() external`  external

Stops process of renounceOwnership and removes timer.





### renounceOwnership


`function renounceOwnership() public`  public


*Developer note: Leaves the contract without owner. It will not be possible to call &#x60;onlyOwner&#x60; functions anymore.
Can only be called by the current owner if RENOUNCE_OWNERSHIP_DELAY seconds
have passed since the call to the startRenounceOwnership() function.*








