

# FarmingCenter

Algebra main farming contract

*Developer note: Manages farmings and performs entry, exit and other actions.*



## Variables
### contract IAlgebraLimitFarming limitFarming immutable



### contract IAlgebraEternalFarming eternalFarming immutable



### contract INonfungiblePositionManager nonfungiblePositionManager immutable



### contract IFarmingCenterVault farmingCenterVault immutable



### mapping(uint256 &#x3D;&gt; struct FarmingCenter.Deposit) deposits 



*Developer note: deposits[tokenId] &#x3D;&gt; Deposit*
### mapping(uint256 &#x3D;&gt; struct FarmingCenter.L2Nft) l2Nfts 




## Functions
### constructor

ERC721Permit, PeripheryPayments

`constructor(contract IAlgebraLimitFarming,contract IAlgebraEternalFarming,contract INonfungiblePositionManager,contract IFarmingCenterVault)`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _limitFarming | contract IAlgebraLimitFarming |  |
| _eternalFarming | contract IAlgebraEternalFarming |  |
| _nonfungiblePositionManager | contract INonfungiblePositionManager |  |
| _farmingCenterVault | contract IFarmingCenterVault |  |


### onERC721Received


`onERC721Received(address,address,uint256,bytes)`  external

Upon receiving a Algebra ERC721, creates the token deposit setting owner to &#x60;from&#x60;.



| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |
| from | address |  |
| tokenId | uint256 |  |
|  | bytes |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes4 |  |

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

### connectVirtualPool


`connectVirtualPool(contract IAlgebraPool,address)`  external

Updates activeIncentive in AlgebraPool



| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | contract IAlgebraPool | The AlgebraPool for which farming was created |
| newVirtualPool | address |  |


### withdrawToken


`withdrawToken(uint256,address,bytes)`  external

Withdraw Algebra NFT-position token



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The id of position NFT |
| to | address | New owner of position NFT |
| data | bytes | The additional data for NonfungiblePositionManager |


### cross


`cross(int24,bool)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| nextTick | int24 | The crossed tick |
| zeroToOne | bool | The direction |


### increaseCumulative


`increaseCumulative(uint32)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| blockTimestamp | uint32 | The current block timestamp, truncated |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| status | enum IAlgebraVirtualPool.Status |  |

### virtualPoolAddresses


`virtualPoolAddresses(address)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| limitVP | address |  |
| eternalVP | address |  |

### getApproved


`getApproved(uint256)` view public





| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |



---


