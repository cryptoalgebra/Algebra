

# IAlgebraFactory


The interface for the Algebra Factory



*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces*


## Events
### RenounceOwnershipStart


`event RenounceOwnershipStart(uint256 timestamp, uint256 finishTimestamp)`  

Emitted when a process of ownership renounce is started



| Name | Type | Description |
| ---- | ---- | ----------- |
| timestamp | uint256 | The timestamp of event |
| finishTimestamp | uint256 | The timestamp when ownership renounce will be possible to finish |


### RenounceOwnershipStop


`event RenounceOwnershipStop(uint256 timestamp)`  

Emitted when a process of ownership renounce cancelled



| Name | Type | Description |
| ---- | ---- | ----------- |
| timestamp | uint256 | The timestamp of event |


### RenounceOwnershipFinish


`event RenounceOwnershipFinish(uint256 timestamp)`  

Emitted when a process of ownership renounce finished



| Name | Type | Description |
| ---- | ---- | ----------- |
| timestamp | uint256 | The timestamp of ownership renouncement |


### Pool


`event Pool(address token0, address token1, address pool)`  

Emitted when a pool is created



| Name | Type | Description |
| ---- | ---- | ----------- |
| token0 | address | The first token of the pool by address sort order |
| token1 | address | The second token of the pool by address sort order |
| pool | address | The address of the created pool |


### FarmingAddress


`event FarmingAddress(address newFarmingAddress)`  

Emitted when the farming address is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| newFarmingAddress | address | The farming address after the address was changed |


### DefaultFeeConfiguration


`event DefaultFeeConfiguration(struct AlgebraFeeConfiguration newConfig)`  

Emitted when the default fee configuration is changed
*Developer note: See the AdaptiveFee library for more details*



| Name | Type | Description |
| ---- | ---- | ----------- |
| newConfig | struct AlgebraFeeConfiguration | The structure with dynamic fee parameters |


### DefaultCommunityFee


`event DefaultCommunityFee(uint8 newDefaultCommunityFee)`  

Emitted when the default community fee is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| newDefaultCommunityFee | uint8 | The new default community fee value |




## Functions
### POOLS_ADMINISTRATOR_ROLE


`function POOLS_ADMINISTRATOR_ROLE() external view returns (bytes32)` view external

role that can change communityFee and tickspacing in pools




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32 |  |

### hasRoleOrOwner


`function hasRoleOrOwner(bytes32 role, address account) external view returns (bool)` view external


*Developer note: Returns &#x60;true&#x60; if &#x60;account&#x60; has been granted &#x60;role&#x60; or &#x60;account&#x60; is owner.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| role | bytes32 |  |
| account | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

### owner


`function owner() external view returns (address)` view external

Returns the current owner of the factory
*Developer note: Can be changed by the current owner via transferOwnership(address newOwner)*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The address of the factory owner |

### poolDeployer


`function poolDeployer() external view returns (address)` view external

Returns the current poolDeployerAddress




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The address of the poolDeployer |

### farmingAddress


`function farmingAddress() external view returns (address)` view external


*Developer note: Is retrieved from the pools to restrict calling certain functions not by a tokenomics contract*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The tokenomics contract address |

### communityVault


`function communityVault() external view returns (address)` view external

Returns the current communityVaultAddress




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The address to which community fees are transferred |

### defaultCommunityFee


`function defaultCommunityFee() external view returns (uint8)` view external

Returns the default community fee




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint8 | Fee which will be set at the creation of the pool |

### poolByPair


`function poolByPair(address tokenA, address tokenB) external view returns (address pool)` view external

Returns the pool address for a given pair of tokens, or address 0 if it does not exist
*Developer note: tokenA and tokenB may be passed in either token0/token1 or token1/token0 order*



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenA | address | The contract address of either token0 or token1 |
| tokenB | address | The contract address of the other token |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The pool address |

### renounceOwnershipStartTimestamp


`function renounceOwnershipStartTimestamp() external view returns (uint256 timestamp)` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| timestamp | uint256 | The timestamp of the beginning of the renounceOwnership process |

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









---

