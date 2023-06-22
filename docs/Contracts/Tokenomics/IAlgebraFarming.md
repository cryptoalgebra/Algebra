

# IAlgebraFarming


Algebra Farming Interface

Allows farming nonfungible liquidity tokens in exchange for reward tokens



## Events
### IncentiveDeactivated


`event IncentiveDeactivated(contract IERC20Minimal rewardToken, contract IERC20Minimal bonusRewardToken, contract IAlgebraPool pool, address virtualPool, uint256 startTime, uint256 endTime)`  

Event emitted when a liquidity mining incentive has been stopped from the outside



| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardToken | contract IERC20Minimal | The token being distributed as a reward |
| bonusRewardToken | contract IERC20Minimal | The token being distributed as a bonus reward |
| pool | contract IAlgebraPool | The Algebra pool |
| virtualPool | address | The detached virtual pool address |
| startTime | uint256 | The time when the incentive program begins |
| endTime | uint256 | The time when rewards stop accruing |


### FarmEntered


`event FarmEntered(uint256 tokenId, bytes32 incentiveId, uint128 liquidity, uint256 tokensLocked)`  

Event emitted when a Algebra LP token has been farmd



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The unique identifier of an Algebra LP token |
| incentiveId | bytes32 | The incentive in which the token is farming |
| liquidity | uint128 | The amount of liquidity farmd |
| tokensLocked | uint256 | The amount of tokens locked for multiplier |


### FarmEnded


`event FarmEnded(uint256 tokenId, bytes32 incentiveId, address rewardAddress, address bonusRewardToken, address owner, uint256 reward, uint256 bonusReward)`  

Event emitted when a Algebra LP token has been exitFarmingd



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The unique identifier of an Algebra LP token |
| incentiveId | bytes32 | The incentive in which the token is farming |
| rewardAddress | address | The token being distributed as a reward |
| bonusRewardToken | address | The token being distributed as a bonus reward |
| owner | address | The address where claimed rewards were sent to |
| reward | uint256 | The amount of reward tokens to be distributed |
| bonusReward | uint256 | The amount of bonus reward tokens to be distributed |


### IncentiveMaker


`event IncentiveMaker(address incentiveMaker)`  

Emitted when the incentive maker is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| incentiveMaker | address | The incentive maker after the address was changed |


### Owner


`event Owner(address owner)`  

Emitted when owner is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The owner after the address was changed |


### FarmingCenter


`event FarmingCenter(address farmingCenter)`  

Emitted when the farming center is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| farmingCenter | address | The farming center after the address was changed |


### RewardsAdded


`event RewardsAdded(uint256 rewardAmount, uint256 bonusRewardAmount, bytes32 incentiveId)`  

Event emitted when rewards were added



| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardAmount | uint256 | The additional amount of main token |
| bonusRewardAmount | uint256 | The additional amount of bonus token |
| incentiveId | bytes32 | The ID of the incentive for which rewards were added |


### RewardAmountsDecreased


`event RewardAmountsDecreased(uint256 reward, uint256 bonusReward, bytes32 incentiveId)`  





| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 |  |
| bonusReward | uint256 |  |
| incentiveId | bytes32 |  |


### RewardClaimed


`event RewardClaimed(address to, uint256 reward, address rewardAddress, address owner)`  

Event emitted when a reward token has been claimed



| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address | The address where claimed rewards were sent to |
| reward | uint256 | The amount of reward tokens claimed |
| rewardAddress | address | The token reward address |
| owner | address | The address where claimed rewards were sent to |


### EmergencyWithdraw


`event EmergencyWithdraw(bool newStatus)`  

Emitted when status of &#x60;isEmergencyWithdrawActivated&#x60; changes



| Name | Type | Description |
| ---- | ---- | ----------- |
| newStatus | bool | New value of &#x60;isEmergencyWithdrawActivated&#x60;. Users can withdraw liquidity without any checks if active. |




## Functions
### nonfungiblePositionManager


`function nonfungiblePositionManager() external view returns (contract INonfungiblePositionManager)` view external

The nonfungible position manager with which this farming contract is compatible




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract INonfungiblePositionManager |  |

### deployer


`function deployer() external returns (contract IAlgebraPoolDeployer)`  external

The pool deployer




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IAlgebraPoolDeployer |  |

### isEmergencyWithdrawActivated


`function isEmergencyWithdrawActivated() external view returns (bool)` view external

Users can withdraw liquidity without any checks if active.




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

### setIncentiveMaker


`function setIncentiveMaker(address _incentiveMaker) external`  external

Updates the incentive maker



| Name | Type | Description |
| ---- | ---- | ----------- |
| _incentiveMaker | address | The new incentive maker address |


### setOwner


`function setOwner(address owner) external`  external

Updates the owner address



| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The new owner address |


### incentives


`function incentives(bytes32 incentiveId) external view returns (uint256 totalReward, uint256 bonusReward, address virtualPoolAddress, uint24 minimalPositionWidth, uint224 totalLiquidity, address multiplierToken, bool deactivated, struct IAlgebraFarming.Tiers tiers)` view external

Represents a farming incentive



| Name | Type | Description |
| ---- | ---- | ----------- |
| incentiveId | bytes32 | The ID of the incentive computed from its parameters |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| totalReward | uint256 |  |
| bonusReward | uint256 |  |
| virtualPoolAddress | address |  |
| minimalPositionWidth | uint24 |  |
| totalLiquidity | uint224 |  |
| multiplierToken | address |  |
| deactivated | bool |  |
| tiers | struct IAlgebraFarming.Tiers |  |

### deactivateIncentive


`function deactivateIncentive(struct IIncentiveKey.IncentiveKey key) external`  external

Detach incentive from the pool and deactivate it



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | The key of the incentive |


### addRewards


`function addRewards(struct IIncentiveKey.IncentiveKey key, uint256 rewardAmount, uint256 bonusRewardAmount) external`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey |  |
| rewardAmount | uint256 |  |
| bonusRewardAmount | uint256 |  |


### decreaseRewardsAmount


`function decreaseRewardsAmount(struct IIncentiveKey.IncentiveKey key, uint256 rewardAmount, uint256 bonusRewardAmount) external`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey |  |
| rewardAmount | uint256 |  |
| bonusRewardAmount | uint256 |  |


### rewards


`function rewards(address owner, contract IERC20Minimal rewardToken) external view returns (uint256 rewardsOwed)` view external

Returns amounts of reward tokens owed to a given address according to the last time all farms were updated



| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The owner for which the rewards owed are checked |
| rewardToken | contract IERC20Minimal | The token for which to check rewards |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardsOwed | uint256 | The amount of the reward token claimable by the owner |

### setFarmingCenterAddress


`function setFarmingCenterAddress(address _farmingCenter) external`  external

Updates farming center address



| Name | Type | Description |
| ---- | ---- | ----------- |
| _farmingCenter | address | The new farming center contract address |


### setEmergencyWithdrawStatus


`function setEmergencyWithdrawStatus(bool newStatus) external`  external

Changes &#x60;isEmergencyWithdrawActivated&#x60;. Users can withdraw liquidity without any checks if activated.
User cannot enter to farmings if activated.
_Must_ only be used in emergency situations. Farmings may be unusable after activation.
*Developer note: only owner*



| Name | Type | Description |
| ---- | ---- | ----------- |
| newStatus | bool | The new status of &#x60;isEmergencyWithdrawActivated&#x60;. |


### enterFarming


`function enterFarming(struct IIncentiveKey.IncentiveKey key, uint256 tokenId, uint256 tokensLocked) external`  external

enter farming for Algebra LP token



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | The key of the incentive for which to enterFarming the NFT |
| tokenId | uint256 | The ID of the token to exitFarming |
| tokensLocked | uint256 | The amount of tokens locked for boost |


### exitFarming


`function exitFarming(struct IIncentiveKey.IncentiveKey key, uint256 tokenId, address _owner) external`  external

exitFarmings for Algebra LP token



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | The key of the incentive for which to exitFarming the NFT |
| tokenId | uint256 | The ID of the token to exitFarming |
| _owner | address | Owner of the token |


### claimReward


`function claimReward(contract IERC20Minimal rewardToken, address to, uint256 amountRequested) external returns (uint256 reward)`  external

Transfers &#x60;amountRequested&#x60; of accrued &#x60;rewardToken&#x60; rewards from the contract to the recipient &#x60;to&#x60;



| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardToken | contract IERC20Minimal | The token being distributed as a reward |
| to | address | The address where claimed rewards will be sent to |
| amountRequested | uint256 | The amount of reward tokens to claim. Claims entire reward amount if set to 0. |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 | The amount of reward tokens claimed |

### claimRewardFrom


`function claimRewardFrom(contract IERC20Minimal rewardToken, address from, address to, uint256 amountRequested) external returns (uint256 reward)`  external

Transfers &#x60;amountRequested&#x60; of accrued &#x60;rewardToken&#x60; rewards from the contract to the recipient &#x60;to&#x60;
only for FarmingCenter



| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardToken | contract IERC20Minimal | The token being distributed as a reward |
| from | address | The address of position owner |
| to | address | The address where claimed rewards will be sent to |
| amountRequested | uint256 | The amount of reward tokens to claim. Claims entire reward amount if set to 0. |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 | The amount of reward tokens claimed |

### getRewardInfo


`function getRewardInfo(struct IIncentiveKey.IncentiveKey key, uint256 tokenId) external returns (uint256 reward, uint256 bonusReward)`  external

Calculates the reward amount that will be received for the given farm



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | The key of the incentive |
| tokenId | uint256 | The ID of the token |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 | The reward accrued to the NFT for the given incentive thus far |
| bonusReward | uint256 | The bonus reward accrued to the NFT for the given incentive thus far |




