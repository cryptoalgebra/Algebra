

# AlgebraFactory


Algebra factory

Is used to deploy pools and its dataStorages

*Developer note: Version: Algebra V2-directional-fee*



## Variables
### bytes32 POOLS_ADMINISTRATOR_ROLE constant

role that can change communityFee and tickspacing in pools

### address poolDeployer immutable

Returns the current poolDeployerAddress

### address communityVault immutable

Returns the current communityVaultAddress

### address farmingAddress 



*Developer note: Is retrieved from the pools to restrict calling certain functions not by a tokenomics contract*
### uint8 defaultCommunityFee 

Returns the default community fee

### uint256 renounceOwnershipStartTimestamp 



### struct AlgebraFeeConfiguration defaultFeeConfiguration 



*Developer note: values of constants for sigmoids in fee calculation formula*
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


*Developer note: Returns &#x60;true&#x60; if &#x60;account&#x60; has been granted &#x60;role&#x60; or &#x60;account&#x60; is owner.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| role | bytes32 |  |
| account | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

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

### setFarmingAddress


`function setFarmingAddress(address newFarmingAddress) external`  external


*Developer note: updates tokenomics address on the factory*



| Name | Type | Description |
| ---- | ---- | ----------- |
| newFarmingAddress | address | The new tokenomics contract address |


### setDefaultCommunityFee


`function setDefaultCommunityFee(uint8 newDefaultCommunityFee) external`  external


*Developer note: updates default community fee for new pools*



| Name | Type | Description |
| ---- | ---- | ----------- |
| newDefaultCommunityFee | uint8 | The new community fee, _must_ be &lt;&#x3D; MAX_COMMUNITY_FEE |


### setDefaultFeeConfiguration


`function setDefaultFeeConfiguration(struct AlgebraFeeConfiguration newConfig) external`  external

Changes initial fee configuration for new pools
*Developer note: changes coefficients for sigmoids: α / (1 + e^( (β-x) / γ))
alpha1 + alpha2 + baseFee (max possible fee) must be &lt;&#x3D; type(uint16).max and gammas must be &gt; 0*



| Name | Type | Description |
| ---- | ---- | ----------- |
| newConfig | struct AlgebraFeeConfiguration | new default fee configuration. See the #AdaptiveFee.sol library for details |


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









---

