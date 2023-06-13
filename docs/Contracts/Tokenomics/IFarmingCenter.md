

# IFarmingCenter








## Events
### DepositTransferred


`event DepositTransferred(uint256 tokenId, address oldOwner, address newOwner)`  

Emitted when ownership of a deposit changes



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the deposit (and token) that is being transferred |
| oldOwner | address | The owner before the deposit was transferred |
| newOwner | address | The owner after the deposit was transferred |




## Functions
### virtualPoolAddresses


`function virtualPoolAddresses(address) external view returns (address, address)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |
| [1] | address |  |

### nonfungiblePositionManager


`function nonfungiblePositionManager() external view returns (contract INonfungiblePositionManager)` view external

The nonfungible position manager with which this farming contract is compatible




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract INonfungiblePositionManager |  |

### limitFarming


`function limitFarming() external view returns (contract IAlgebraLimitFarming)` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IAlgebraLimitFarming |  |

### eternalFarming


`function eternalFarming() external view returns (contract IAlgebraEternalFarming)` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IAlgebraEternalFarming |  |

### farmingCenterVault


`function farmingCenterVault() external view returns (contract IFarmingCenterVault)` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IFarmingCenterVault |  |

### l2Nfts


`function l2Nfts(uint256) external view returns (uint96 nonce, address operator, uint256 tokenId)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
|  | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| nonce | uint96 |  |
| operator | address |  |
| tokenId | uint256 |  |

### deposits


`function deposits(uint256 tokenId) external view returns (uint256 L2TokenId, uint32 numberOfFarms, bool inLimitFarming, address owner)` view external

Returns information about a deposited NFT



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the deposit (and token) that is being transferred |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| L2TokenId | uint256 | The nft layer2 id, numberOfFarms The number of farms, inLimitFarming The parameter showing if the token is in the limit farm, owner The owner of deposit |
| numberOfFarms | uint32 |  |
| inLimitFarming | bool |  |
| owner | address |  |

### connectVirtualPool


`function connectVirtualPool(contract IAlgebraPool pool, address virtualPool) external`  external

Updates activeIncentive in AlgebraPool
*Developer note: only farming can do it*



| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | contract IAlgebraPool | The AlgebraPool for which farming was created |
| virtualPool | address | The virtual pool to be connected |


### enterFarming


`function enterFarming(struct IIncentiveKey.IncentiveKey key, uint256 tokenId, uint256 tokensLocked, bool isLimit) external`  external

Enters in incentive (time-limited or eternal farming) with NFT-position token
*Developer note: token must be deposited in FarmingCenter*



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | The incentive event key |
| tokenId | uint256 | The id of position NFT |
| tokensLocked | uint256 | Amount of tokens to lock for liquidity multiplier (if tiers are used) |
| isLimit | bool | Is incentive time-limited or eternal |


### exitFarming


`function exitFarming(struct IIncentiveKey.IncentiveKey key, uint256 tokenId, bool isLimit) external`  external

Exits from incentive (time-limited or eternal farming) with NFT-position token



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | The incentive event key |
| tokenId | uint256 | The id of position NFT |
| isLimit | bool | Is incentive time-limited or eternal |


### collect


`function collect(struct INonfungiblePositionManager.CollectParams params) external returns (uint256 amount0, uint256 amount1)`  external

Collects up to a maximum amount of fees owed to a specific position to the recipient
*Developer note: &quot;proxies&quot; to NonfungiblePositionManager*



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct INonfungiblePositionManager.CollectParams | tokenId The ID of the NFT for which tokens are being collected, recipient The account that should receive the tokens, amount0Max The maximum amount of token0 to collect, amount1Max The maximum amount of token1 to collect |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint256 | The amount of fees collected in token0 |
| amount1 | uint256 | The amount of fees collected in token1 |

### collectRewards


`function collectRewards(struct IIncentiveKey.IncentiveKey key, uint256 tokenId) external returns (uint256 reward, uint256 bonusReward)`  external

Used to collect reward from eternal farming. Then reward can be claimed.



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | The incentive event key |
| tokenId | uint256 | The id of position NFT |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 | The amount of collected reward |
| bonusReward | uint256 | The amount of collected  bonus reward |

### claimReward


`function claimReward(contract IERC20Minimal rewardToken, address to, uint256 amountRequestedIncentive, uint256 amountRequestedEternal) external returns (uint256 reward)`  external

Used to claim and send rewards from farming(s)
*Developer note: can be used via static call to get current rewards for user*



| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardToken | contract IERC20Minimal | The token that is a reward |
| to | address | The address to be rewarded |
| amountRequestedIncentive | uint256 | Amount to claim in incentive (limit) farming |
| amountRequestedEternal | uint256 | Amount to claim in eternal farming |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 | The summary amount of claimed rewards |

### withdrawToken


`function withdrawToken(uint256 tokenId, address to, bytes data) external`  external

Withdraw Algebra NFT-position token
*Developer note: can be used via static call to get current rewards for user*



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The id of position NFT |
| to | address | New owner of position NFT |
| data | bytes | The additional data for NonfungiblePositionManager |





