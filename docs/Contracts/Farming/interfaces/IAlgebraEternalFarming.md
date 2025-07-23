

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

Event emitted when a Algebra LP token has been farmed

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The unique identifier of an Algebra LP token |
| incentiveId | bytes32 | The incentive in which the token is farming |
| liquidity | uint128 | The amount of liquidity farmed |

### FarmEnded

```solidity
event FarmEnded(uint256 tokenId, bytes32 incentiveId, address rewardAddress, address bonusRewardToken, address owner, uint256 reward, uint256 bonusReward)
```

Event emitted when a Algebra LP token exited from farming

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The unique identifier of an Algebra LP token |
| incentiveId | bytes32 | The incentive in which the token is farming |
| rewardAddress | address | The token being distributed as a reward |
| bonusRewardToken | address | The token being distributed as a bonus reward |
| owner | address | The address where claimed rewards were sent to |
| reward | uint256 | The amount of reward tokens to be claimed |
| bonusReward | uint256 | The amount of bonus reward tokens to be claimed |

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
event RewardAmountsDecreased(uint256 rewardAmount, uint256 bonusRewardAmount, bytes32 incentiveId)
```

Event emitted when rewards were decreased

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardAmount | uint256 | The withdrawn amount of main token |
| bonusRewardAmount | uint256 | The withdrawn amount of bonus token |
| incentiveId | bytes32 | The ID of the incentive for which rewards were decreased |

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
| owner | address | The address where claimed rewards were claimed from |

### RewardsRatesChanged

```solidity
event RewardsRatesChanged(uint128 rewardRate, uint128 bonusRewardRate, bytes32 incentiveId)
```

Event emitted when reward rates were changed

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardRate | uint128 | The new rate of main token (token0) distribution per sec |
| bonusRewardRate | uint128 | The new rate of bonus token (token1) distribution per sec |
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

Details of the incentive to create

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
### INCENTIVE_MAKER_ROLE

```solidity
function INCENTIVE_MAKER_ROLE() external view returns (bytes32)
```
**Selector**: `0xb8883c50`

Returns hash of &#x27;INCENTIVE_MAKER_ROLE&#x27;, used as role for incentive creation

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32 |  |

### FARMINGS_ADMINISTRATOR_ROLE

```solidity
function FARMINGS_ADMINISTRATOR_ROLE() external view returns (bytes32)
```
**Selector**: `0x3c6d0715`

Returns hash of &#x27;FARMINGS_ADMINISTRATOR_ROLE&#x27;, used as role for permissioned actions in farming

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32 |  |

### nonfungiblePositionManager

```solidity
function nonfungiblePositionManager() external view returns (contract INonfungiblePositionManager)
```
**Selector**: `0xb44a2722`

The nonfungible position manager with which this farming contract is compatible

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract INonfungiblePositionManager |  |

### incentives

```solidity
function incentives(bytes32 incentiveId) external view returns (uint128 totalReward, uint128 bonusReward, address virtualPoolAddress, uint24 minimalPositionWidth, bool deactivated, address pluginAddress)
```
**Selector**: `0x60777795`

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

### isIncentiveDeactivated

```solidity
function isIncentiveDeactivated(bytes32 incentiveId) external view returns (bool)
```
**Selector**: `0xb5bae00a`

Check if incentive is deactivated (manually or automatically)

*Developer note: Does not check if the incentive is indeed currently connected to the Algebra pool or not*

| Name | Type | Description |
| ---- | ---- | ----------- |
| incentiveId | bytes32 | The ID of the incentive computed from its parameters |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if incentive is deactivated (manually or automatically) |

### farmingCenter

```solidity
function farmingCenter() external view returns (address)
```
**Selector**: `0xdd56e5d8`

Returns address of current farmingCenter

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

### isEmergencyWithdrawActivated

```solidity
function isEmergencyWithdrawActivated() external view returns (bool)
```
**Selector**: `0xf2256319`

Users can withdraw liquidity without any checks if active.

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

### deactivateIncentive

```solidity
function deactivateIncentive(struct IncentiveKey key) external
```
**Selector**: `0x2912bf10`

Detach incentive from the pool and deactivate it

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | The key of the incentive |

### addRewards

```solidity
function addRewards(struct IncentiveKey key, uint128 rewardAmount, uint128 bonusRewardAmount) external
```
**Selector**: `0xf26ebf7a`

Add rewards for incentive

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | The key of the incentive |
| rewardAmount | uint128 | The amount of token0 |
| bonusRewardAmount | uint128 | The amount of token1 |

### decreaseRewardsAmount

```solidity
function decreaseRewardsAmount(struct IncentiveKey key, uint128 rewardAmount, uint128 bonusRewardAmount) external
```
**Selector**: `0xf6de3cae`

Decrease rewards for incentive and withdraw

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | The key of the incentive |
| rewardAmount | uint128 | The amount of token0 |
| bonusRewardAmount | uint128 | The amount of token1 |

### setEmergencyWithdrawStatus

```solidity
function setEmergencyWithdrawStatus(bool newStatus) external
```
**Selector**: `0x890cdcb3`

Changes &#x60;isEmergencyWithdrawActivated&#x60;. Users can withdraw liquidity without any checks if activated.
User cannot enter to farmings if activated.
_Must_ only be used in emergency situations. Farmings may be unusable after activation.

*Developer note: only farmings administrator*

| Name | Type | Description |
| ---- | ---- | ----------- |
| newStatus | bool | The new status of `isEmergencyWithdrawActivated`. |

### numOfIncentives

```solidity
function numOfIncentives() external view returns (uint256)
```
**Selector**: `0x82bd79ea`

Returns amount of created incentives

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### rewards

```solidity
function rewards(address owner, contract IERC20Minimal rewardToken) external view returns (uint256 rewardsOwed)
```
**Selector**: `0xe70b9e27`

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
**Selector**: `0xdf42efda`

Updates farming center address

| Name | Type | Description |
| ---- | ---- | ----------- |
| _farmingCenter | address | The new farming center contract address |

### enterFarming

```solidity
function enterFarming(struct IncentiveKey key, uint256 tokenId) external
```
**Selector**: `0x5739f0b9`

enter farming for Algebra LP token

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | The key of the incentive for which to enter farming |
| tokenId | uint256 | The ID of the token to enter farming |

### exitFarming

```solidity
function exitFarming(struct IncentiveKey key, uint256 tokenId, address _owner) external
```
**Selector**: `0x36808b19`

exitFarmings for Algebra LP token

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | The key of the incentive for which to exit farming |
| tokenId | uint256 | The ID of the token to exit farming |
| _owner | address | Owner of the token |

### claimReward

```solidity
function claimReward(contract IERC20Minimal rewardToken, address to, uint256 amountRequested) external returns (uint256 rewardBalanceBefore)
```
**Selector**: `0x2f2d783d`

Transfers &#x60;amountRequested&#x60; of accrued &#x60;rewardToken&#x60; (if possible) rewards from the contract to the recipient &#x60;to&#x60;

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardToken | contract IERC20Minimal | The token being distributed as a reward |
| to | address | The address where claimed rewards will be sent to |
| amountRequested | uint256 | The amount of reward tokens to claim. Claims entire reward amount if set to 0. |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardBalanceBefore | uint256 | The total amount of unclaimed reward *before* claim |

### claimRewardFrom

```solidity
function claimRewardFrom(contract IERC20Minimal rewardToken, address from, address to, uint256 amountRequested) external returns (uint256 rewardBalanceBefore)
```
**Selector**: `0x0a530754`

Transfers &#x60;amountRequested&#x60; of accrued &#x60;rewardToken&#x60; (if possible) rewards from the contract to the recipient &#x60;to&#x60;
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
| rewardBalanceBefore | uint256 | The total amount of unclaimed reward *before* claim |

### getRewardInfo

```solidity
function getRewardInfo(struct IncentiveKey key, uint256 tokenId) external returns (uint256 reward, uint256 bonusReward)
```
**Selector**: `0x96da9bd5`

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
**Selector**: `0x27e6a99a`

Returns information about a farmed liquidity NFT

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the farmed token |
| incentiveId | bytes32 | The ID of the incentive for which the token is farmed |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidity | uint128 | The amount of liquidity in the NFT as of the last time the rewards were computed, |
| tickLower | int24 | The lower tick of position, |
| tickUpper | int24 | The upper tick of position, |
| innerRewardGrowth0 | uint256 | The last saved reward0 growth inside position, |
| innerRewardGrowth1 | uint256 | The last saved reward1 growth inside position |

### createEternalFarming

```solidity
function createEternalFarming(struct IncentiveKey key, struct IAlgebraEternalFarming.IncentiveParams params, address plugin) external returns (address virtualPool)
```
**Selector**: `0x547b6da9`

Creates a new liquidity farming incentive program

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | Details of the incentive to create |
| params | struct IAlgebraEternalFarming.IncentiveParams | Params of incentive |
| plugin | address | The address of corresponding plugin |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPool | address | The created virtual pool |

### setRates

```solidity
function setRates(struct IncentiveKey key, uint128 rewardRate, uint128 bonusRewardRate) external
```
**Selector**: `0x84335241`

Change reward rates for incentive

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | The key of incentive |
| rewardRate | uint128 | The new rate of main token (token0) distribution per sec |
| bonusRewardRate | uint128 | The new rate of bonus token (token1) distribution per sec |

### collectRewards

```solidity
function collectRewards(struct IncentiveKey key, uint256 tokenId, address _owner) external returns (uint256 reward, uint256 bonusReward)
```
**Selector**: `0x046ec166`

Collect rewards for tokenId

*Developer note: only FarmingCenter*

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | The key of incentive |
| tokenId | uint256 | The ID of the token to exit farming |
| _owner | address | Owner of the token |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 | The amount of main token (token0) collected |
| bonusReward | uint256 |  |


## Errors
## farmDoesNotExist

```solidity
error farmDoesNotExist()
```
**Selector**: `0x7aa92c66`



## tokenAlreadyFarmed

```solidity
error tokenAlreadyFarmed()
```
**Selector**: `0xf352b375`



## incentiveNotExist

```solidity
error incentiveNotExist()
```
**Selector**: `0xe4c82292`



## incentiveStopped

```solidity
error incentiveStopped()
```
**Selector**: `0x260e553a`



## anotherFarmingIsActive

```solidity
error anotherFarmingIsActive()
```
**Selector**: `0x47146bcc`



## pluginNotConnected

```solidity
error pluginNotConnected()
```
**Selector**: `0x093d6f17`



## minimalPositionWidthTooWide

```solidity
error minimalPositionWidthTooWide()
```
**Selector**: `0x1db98911`



## zeroRewardAmount

```solidity
error zeroRewardAmount()
```
**Selector**: `0x36ab0f6a`



## positionIsTooNarrow

```solidity
error positionIsTooNarrow()
```
**Selector**: `0xeab05850`



## zeroLiquidity

```solidity
error zeroLiquidity()
```
**Selector**: `0x4eed4360`



## invalidPool

```solidity
error invalidPool()
```
**Selector**: `0xdce28093`



## claimToZeroAddress

```solidity
error claimToZeroAddress()
```
**Selector**: `0xabd17636`



## invalidTokenAmount

```solidity
error invalidTokenAmount()
```
**Selector**: `0x3ba11f1e`



## emergencyActivated

```solidity
error emergencyActivated()
```
**Selector**: `0x05bfeb59`



## reentrancyLock

```solidity
error reentrancyLock()
```
**Selector**: `0x2446d79f`



## poolReentrancyLock

```solidity
error poolReentrancyLock()
```
**Selector**: `0x9ded0f57`



