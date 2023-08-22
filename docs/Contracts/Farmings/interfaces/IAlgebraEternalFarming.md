

# IAlgebraEternalFarming


Algebra Eternal Farming Interface

Allows farming nonfungible liquidity tokens in exchange for reward tokens without locking NFT for incentive time


## Events
### IncentiveDeactivated

```solidity
event IncentiveDeactivated(bytes32 incentiveId)
```

Event emitted when a liquidity mining incentive has been stopped from the outside

| Name | Type | Description |
| ---- | ---- | ----------- |
| incentiveId | bytes32 | The stopped incentive |

### FarmEntered

```solidity
event FarmEntered(uint256 tokenId, bytes32 incentiveId, uint128 liquidity)
```

Event emitted when a Algebra LP token has been farmd

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The unique identifier of an Algebra LP token |
| incentiveId | bytes32 | The incentive in which the token is farming |
| liquidity | uint128 | The amount of liquidity farmd |

### FarmEnded

```solidity
event FarmEnded(uint256 tokenId, bytes32 incentiveId, address rewardAddress, address bonusRewardToken, address owner, uint256 reward, uint256 bonusReward)
```

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

```solidity
event IncentiveMaker(address incentiveMaker)
```

Emitted when the incentive maker is changed

| Name | Type | Description |
| ---- | ---- | ----------- |
| incentiveMaker | address | The incentive maker after the address was changed |

### FarmingCenter

```solidity
event FarmingCenter(address farmingCenter)
```

Emitted when the farming center is changed

| Name | Type | Description |
| ---- | ---- | ----------- |
| farmingCenter | address | The farming center after the address was changed |

### RewardsAdded

```solidity
event RewardsAdded(uint256 rewardAmount, uint256 bonusRewardAmount, bytes32 incentiveId)
```

Event emitted when rewards were added

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardAmount | uint256 | The additional amount of main token |
| bonusRewardAmount | uint256 | The additional amount of bonus token |
| incentiveId | bytes32 | The ID of the incentive for which rewards were added |

### RewardAmountsDecreased

```solidity
event RewardAmountsDecreased(uint256 reward, uint256 bonusReward, bytes32 incentiveId)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 |  |
| bonusReward | uint256 |  |
| incentiveId | bytes32 |  |

### RewardClaimed

```solidity
event RewardClaimed(address to, uint256 reward, address rewardAddress, address owner)
```

Event emitted when a reward token has been claimed

| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address | The address where claimed rewards were sent to |
| reward | uint256 | The amount of reward tokens claimed |
| rewardAddress | address | The token reward address |
| owner | address | The address where claimed rewards were sent to |

### RewardsRatesChanged

```solidity
event RewardsRatesChanged(uint128 rewardRate, uint128 bonusRewardRate, bytes32 incentiveId)
```

Event emitted when reward rates were changed

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardRate | uint128 | The new rate of main token distribution per sec |
| bonusRewardRate | uint128 | The new rate of bonus token distribution per sec |
| incentiveId | bytes32 | The ID of the incentive for which rates were changed |

### RewardsCollected

```solidity
event RewardsCollected(uint256 tokenId, bytes32 incentiveId, uint256 rewardAmount, uint256 bonusRewardAmount)
```

Event emitted when rewards were collected

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token for which rewards were collected |
| incentiveId | bytes32 | The ID of the incentive for which rewards were collected |
| rewardAmount | uint256 | Collected amount of reward |
| bonusRewardAmount | uint256 | Collected amount of bonus reward |

### EternalFarmingCreated

```solidity
event EternalFarmingCreated(contract IERC20Minimal rewardToken, contract IERC20Minimal bonusRewardToken, contract IAlgebraPool pool, address virtualPool, uint256 nonce, uint256 reward, uint256 bonusReward, uint24 minimalAllowedPositionWidth)
```

Event emitted when a liquidity mining incentive has been created

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardToken | contract IERC20Minimal | The token being distributed as a reward |
| bonusRewardToken | contract IERC20Minimal | The token being distributed as a bonus reward |
| pool | contract IAlgebraPool | The Algebra pool |
| virtualPool | address | The virtual pool address |
| nonce | uint256 | The nonce of new farming |
| reward | uint256 | The amount of reward tokens to be distributed |
| bonusReward | uint256 | The amount of bonus reward tokens to be distributed |
| minimalAllowedPositionWidth | uint24 | The minimal allowed position width (tickUpper - tickLower) |

### EmergencyWithdraw

```solidity
event EmergencyWithdraw(bool newStatus)
```

Emitted when status of &#x60;isEmergencyWithdrawActivated&#x60; changes

| Name | Type | Description |
| ---- | ---- | ----------- |
| newStatus | bool | New value of `isEmergencyWithdrawActivated`. Users can withdraw liquidity without any checks if active. |


## Structs
### IncentiveParams



```solidity
struct IncentiveParams {
  uint128 reward;
  uint128 bonusReward;
  uint128 rewardRate;
  uint128 bonusRewardRate;
  uint24 minimalPositionWidth;
}
```


## Functions
### nonfungiblePositionManager

```solidity
function nonfungiblePositionManager() external view returns (contract INonfungiblePositionManager)
```

The nonfungible position manager with which this farming contract is compatible

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract INonfungiblePositionManager |  |

### incentives

```solidity
function incentives(bytes32 incentiveId) external view returns (uint128 totalReward, uint128 bonusReward, address virtualPoolAddress, uint24 minimalPositionWidth, bool deactivated, address pluginAddress)
```

Represents a farming incentive

| Name | Type | Description |
| ---- | ---- | ----------- |
| incentiveId | bytes32 | The ID of the incentive computed from its parameters |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| totalReward | uint128 |  |
| bonusReward | uint128 |  |
| virtualPoolAddress | address |  |
| minimalPositionWidth | uint24 |  |
| deactivated | bool |  |
| pluginAddress | address |  |

### isIncentiveActive

```solidity
function isIncentiveActive(bytes32 incentiveId) external view returns (bool res)
```

Check if incentive is active

*Developer note: Does not check that the incentive is indeed currently connected to the Algebra pool*

| Name | Type | Description |
| ---- | ---- | ----------- |
| incentiveId | bytes32 | The ID of the incentive computed from its parameters |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| res | bool | True if incentive is active |

### isEmergencyWithdrawActivated

```solidity
function isEmergencyWithdrawActivated() external view returns (bool)
```

Users can withdraw liquidity without any checks if active.

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

### deactivateIncentive

```solidity
function deactivateIncentive(struct IncentiveKey key) external
```

Detach incentive from the pool and deactivate it

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | The key of the incentive |

### addRewards

```solidity
function addRewards(struct IncentiveKey key, uint128 rewardAmount, uint128 bonusRewardAmount) external
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey |  |
| rewardAmount | uint128 |  |
| bonusRewardAmount | uint128 |  |

### decreaseRewardsAmount

```solidity
function decreaseRewardsAmount(struct IncentiveKey key, uint128 rewardAmount, uint128 bonusRewardAmount) external
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey |  |
| rewardAmount | uint128 |  |
| bonusRewardAmount | uint128 |  |

### setEmergencyWithdrawStatus

```solidity
function setEmergencyWithdrawStatus(bool newStatus) external
```

Changes &#x60;isEmergencyWithdrawActivated&#x60;. Users can withdraw liquidity without any checks if activated.
User cannot enter to farmings if activated.
_Must_ only be used in emergency situations. Farmings may be unusable after activation.

*Developer note: only farmings administrator*

| Name | Type | Description |
| ---- | ---- | ----------- |
| newStatus | bool | The new status of `isEmergencyWithdrawActivated`. |

### rewards

```solidity
function rewards(address owner, contract IERC20Minimal rewardToken) external view returns (uint256 rewardsOwed)
```

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

```solidity
function setFarmingCenterAddress(address _farmingCenter) external
```

Updates farming center address

| Name | Type | Description |
| ---- | ---- | ----------- |
| _farmingCenter | address | The new farming center contract address |

### enterFarming

```solidity
function enterFarming(struct IncentiveKey key, uint256 tokenId) external
```

enter farming for Algebra LP token

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | The key of the incentive for which to enterFarming the NFT |
| tokenId | uint256 | The ID of the token to exitFarming |

### exitFarming

```solidity
function exitFarming(struct IncentiveKey key, uint256 tokenId, address _owner) external
```

exitFarmings for Algebra LP token

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | The key of the incentive for which to exitFarming the NFT |
| tokenId | uint256 | The ID of the token to exitFarming |
| _owner | address | Owner of the token |

### claimReward

```solidity
function claimReward(contract IERC20Minimal rewardToken, address to, uint256 amountRequested) external returns (uint256 reward)
```

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

```solidity
function claimRewardFrom(contract IERC20Minimal rewardToken, address from, address to, uint256 amountRequested) external returns (uint256 reward)
```

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

```solidity
function getRewardInfo(struct IncentiveKey key, uint256 tokenId) external returns (uint256 reward, uint256 bonusReward)
```

Calculates the reward amount that will be received for the given farm

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | The key of the incentive |
| tokenId | uint256 | The ID of the token |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 | The reward accrued to the NFT for the given incentive thus far |
| bonusReward | uint256 | The bonus reward accrued to the NFT for the given incentive thus far |

### farms

```solidity
function farms(uint256 tokenId, bytes32 incentiveId) external view returns (uint128 liquidity, int24 tickLower, int24 tickUpper, uint256 innerRewardGrowth0, uint256 innerRewardGrowth1)
```

Returns information about a farmd liquidity NFT

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the farmd token |
| incentiveId | bytes32 | The ID of the incentive for which the token is farmd |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidity | uint128 | The amount of liquidity in the NFT as of the last time the rewards were computed, tickLower The lower tick of position, tickUpper The upper tick of position, innerRewardGrowth0 The last saved reward0 growth inside position, innerRewardGrowth1 The last saved reward1 growth inside position |
| tickLower | int24 |  |
| tickUpper | int24 |  |
| innerRewardGrowth0 | uint256 |  |
| innerRewardGrowth1 | uint256 |  |

### createEternalFarming

```solidity
function createEternalFarming(struct IncentiveKey key, struct IAlgebraEternalFarming.IncentiveParams params) external returns (address virtualPool)
```

Creates a new liquidity mining incentive program

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | Details of the incentive to create |
| params | struct IAlgebraEternalFarming.IncentiveParams | Params of incentive |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPool | address | The virtual pool |

### setRates

```solidity
function setRates(struct IncentiveKey key, uint128 rewardRate, uint128 bonusRewardRate) external
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey |  |
| rewardRate | uint128 |  |
| bonusRewardRate | uint128 |  |

### collectRewards

```solidity
function collectRewards(struct IncentiveKey key, uint256 tokenId, address _owner) external returns (uint256 reward, uint256 bonusReward)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey |  |
| tokenId | uint256 |  |
| _owner | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 |  |
| bonusReward | uint256 |  |


## Errors
## farmingAlreadyExists

```solidity
error farmingAlreadyExists()
```



## farmDoesNotExist

```solidity
error farmDoesNotExist()
```



## tokenAlreadyFarmed

```solidity
error tokenAlreadyFarmed()
```



## incentiveNotExist

```solidity
error incentiveNotExist()
```



## incentiveStopped

```solidity
error incentiveStopped()
```



## anotherFarmingIsActive

```solidity
error anotherFarmingIsActive()
```



## pluginNotConnected

```solidity
error pluginNotConnected()
```



## minimalPositionWidthTooWide

```solidity
error minimalPositionWidthTooWide()
```



## zeroRewardAmount

```solidity
error zeroRewardAmount()
```



## positionIsTooNarrow

```solidity
error positionIsTooNarrow()
```



## zeroLiquidity

```solidity
error zeroLiquidity()
```



## invalidPool

```solidity
error invalidPool()
```



## claimToZeroAddress

```solidity
error claimToZeroAddress()
```



## invalidTokenAmount

```solidity
error invalidTokenAmount()
```



## emergencyActivated

```solidity
error emergencyActivated()
```



## reentrancyLock

```solidity
error reentrancyLock()
```



