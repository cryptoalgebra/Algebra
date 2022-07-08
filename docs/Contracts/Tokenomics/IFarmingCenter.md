

# IFarmingCenter





## Events
### DepositTransferred


`DepositTransferred(uint256,address,address)`  

Emitted when ownership of a deposit changes



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the deposit (and token) that is being transferred |
| oldOwner | address | The owner before the deposit was transferred |
| newOwner | address | The owner after the deposit was transferred |




## Functions
### virtualPoolAddresses


`virtualPoolAddresses(address)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |
| [1] | address |  |

### nonfungiblePositionManager


`nonfungiblePositionManager()` view external

The nonfungible position manager with which this farming contract is compatible




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract INonfungiblePositionManager |  |

### limitFarming


`limitFarming()` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IAlgebraLimitFarming |  |

### eternalFarming


`eternalFarming()` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IAlgebraEternalFarming |  |

### farmingCenterVault


`farmingCenterVault()` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IFarmingCenterVault |  |

### l2Nfts


`l2Nfts(uint256)` view external





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


`deposits(uint256)` view external

Returns information about a deposited NFT



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the deposit (and token) that is being transferred |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| L2TokenId | uint256 |  |
| numberOfFarms | uint32 |  |
| inLimitFarming | bool |  |
| owner | address |  |

### connectVirtualPool


`connectVirtualPool(contract IAlgebraPool,address)`  external

Updates activeIncentive in AlgebraPool



| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | contract IAlgebraPool | The AlgebraPool for which farming was created |
| virtualPool | address | The virtual pool to be connected |


### enterFarming


`enterFarming(struct IIncentiveKey.IncentiveKey,uint256,uint256,bool)`  external

Enters in incentive (time-limited or eternal farming) with NFT-position token



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | The incentive event key |
| tokenId | uint256 | The id of position NFT |
| tokensLocked | uint256 | Amount of tokens to lock for liquidity multiplier (if tiers are used) |
| isLimit | bool | Is incentive time-limited or eternal |


### exitFarming


`exitFarming(struct IIncentiveKey.IncentiveKey,uint256,bool)`  external

Exits from incentive (time-limited or eternal farming) with NFT-position token



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | The incentive event key |
| tokenId | uint256 | The id of position NFT |
| isLimit | bool | Is incentive time-limited or eternal |


### collect


`collect(struct INonfungiblePositionManager.CollectParams)`  external

Collects up to a maximum amount of fees owed to a specific position to the recipient



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct INonfungiblePositionManager.CollectParams | tokenId The ID of the NFT for which tokens are being collected, recipient The account that should receive the tokens, amount0Max The maximum amount of token0 to collect, amount1Max The maximum amount of token1 to collect |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint256 |  |
| amount1 | uint256 |  |

### collectRewards


`collectRewards(struct IIncentiveKey.IncentiveKey,uint256)`  external

Used to collect reward from eternal farming. Then reward can be claimed.



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | The incentive event key |
| tokenId | uint256 | The id of position NFT |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 |  |
| bonusReward | uint256 |  |

### claimReward


`claimReward(contract IERC20Minimal,address,uint256,uint256)`  external

Used to claim and send rewards from farming(s)



| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardToken | contract IERC20Minimal | The token that is a reward |
| to | address | The address to be rewarded |
| amountRequestedIncentive | uint256 | Amount to claim in incentive (limit) farming |
| amountRequestedEternal | uint256 | Amount to claim in eternal farming |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 |  |

### withdrawToken


`withdrawToken(uint256,address,bytes)`  external

Withdraw Algebra NFT-position token



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The id of position NFT |
| to | address | New owner of position NFT |
| data | bytes | The additional data for NonfungiblePositionManager |




---


