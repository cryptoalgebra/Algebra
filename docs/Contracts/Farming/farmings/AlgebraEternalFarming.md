

# AlgebraEternalFarming


Algebra eternal (v2-like) farming

Manages rewards and virtual pools

**Inherits:** [IAlgebraEternalFarming](../interfaces/IAlgebraEternalFarming.md)
## Modifiers
### onlyIncentiveMaker

```solidity
modifier onlyIncentiveMaker()
```



### onlyAdministrator

```solidity
modifier onlyAdministrator()
```



### onlyFarmingCenter

```solidity
modifier onlyFarmingCenter()
```




## Structs
### Incentive

Represents a farming incentive

```solidity
struct Incentive {
  uint128 totalReward;
  uint128 bonusReward;
  address virtualPoolAddress;
  uint24 minimalPositionWidth;
  bool deactivated;
  address pluginAddress;
}
```

### Farm

Represents the farm for nft

```solidity
struct Farm {
  uint128 liquidity;
  int24 tickLower;
  int24 tickUpper;
  uint256 innerRewardGrowth0;
  uint256 innerRewardGrowth1;
}
```


## Public variables
### INCENTIVE_MAKER_ROLE
```solidity
bytes32 constant INCENTIVE_MAKER_ROLE = 0xa777c10270ee0b99d2c737c09ff865ed48064b252418bbd31d39c8b88ea12219
```
**Selector**: `0xb8883c50`

Returns hash of &#x27;INCENTIVE_MAKER_ROLE&#x27;, used as role for incentive creation


### FARMINGS_ADMINISTRATOR_ROLE
```solidity
bytes32 constant FARMINGS_ADMINISTRATOR_ROLE = 0x681ab0361ab5f3ae8c1d864335ef2b9a8c12a6a67e1ed0f4083d00a4b8a9a395
```
**Selector**: `0x3c6d0715`

Returns hash of &#x27;FARMINGS_ADMINISTRATOR_ROLE&#x27;, used as role for permissioned actions in farming


### nonfungiblePositionManager
```solidity
contract INonfungiblePositionManager immutable nonfungiblePositionManager
```
**Selector**: `0xb44a2722`

The nonfungible position manager with which this farming contract is compatible


### farmingCenter
```solidity
address farmingCenter
```
**Selector**: `0xdd56e5d8`

Returns address of current farmingCenter


### isEmergencyWithdrawActivated
```solidity
bool isEmergencyWithdrawActivated
```
**Selector**: `0xf2256319`

Users can withdraw liquidity without any checks if active.


### incentives
```solidity
mapping(bytes32 => struct AlgebraEternalFarming.Incentive) incentives
```
**Selector**: `0x60777795`

Represents a farming incentive

*Developer note: bytes32 incentiveId refers to the return value of IncentiveId.compute*

### farms
```solidity
mapping(uint256 => mapping(bytes32 => struct AlgebraEternalFarming.Farm)) farms
```
**Selector**: `0x27e6a99a`

Returns information about a farmed liquidity NFT

*Developer note: farms[tokenId][incentiveHash] => Farm*

### numOfIncentives
```solidity
uint256 numOfIncentives
```
**Selector**: `0x82bd79ea`

Returns amount of created incentives


### rewards
```solidity
mapping(address => mapping(contract IERC20Minimal => uint256)) rewards
```
**Selector**: `0xe70b9e27`

Returns amounts of reward tokens owed to a given address according to the last time all farms were updated

*Developer note: rewards[owner][rewardToken] => uint256*


## Functions
### constructor

```solidity
constructor(contract IAlgebraPoolDeployer _deployer, contract INonfungiblePositionManager _nonfungiblePositionManager) public
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| _deployer | contract IAlgebraPoolDeployer | pool deployer contract address |
| _nonfungiblePositionManager | contract INonfungiblePositionManager | the NFT position manager contract address |

### isIncentiveDeactivated

```solidity
function isIncentiveDeactivated(bytes32 incentiveId) external view returns (bool res)
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
| res | bool | True if incentive is deactivated (manually or automatically) |

### createEternalFarming

```solidity
function createEternalFarming(struct IncentiveKey key, struct IAlgebraEternalFarming.IncentiveParams params) external returns (address virtualPool)
```
**Selector**: `0x566d3c71`

Creates a new liquidity farming incentive program

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | Details of the incentive to create |
| params | struct IAlgebraEternalFarming.IncentiveParams | Params of incentive |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPool | address | The created virtual pool |

### deactivateIncentive

```solidity
function deactivateIncentive(struct IncentiveKey key) external
```
**Selector**: `0x2912bf10`

Detach incentive from the pool and deactivate it

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | The key of the incentive |

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

### setFarmingCenterAddress

```solidity
function setFarmingCenterAddress(address _farmingCenter) external
```
**Selector**: `0xdf42efda`

Updates farming center address

| Name | Type | Description |
| ---- | ---- | ----------- |
| _farmingCenter | address | The new farming center contract address |

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
function claimReward(contract IERC20Minimal rewardToken, address to, uint256 amountRequested) external returns (uint256 reward)
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
| reward | uint256 | The amount of reward tokens claimed |

### claimRewardFrom

```solidity
function claimRewardFrom(contract IERC20Minimal rewardToken, address from, address to, uint256 amountRequested) external returns (uint256 reward)
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
| reward | uint256 | The amount of reward tokens claimed |

### getRewardInfo

```solidity
function getRewardInfo(struct IncentiveKey key, uint256 tokenId) external view returns (uint256 reward, uint256 bonusReward)
```
**Selector**: `0x96da9bd5`

reward amounts can be outdated, actual amounts could be obtained via static call of &#x60;collectRewards&#x60; in FarmingCenter

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | The key of the incentive |
| tokenId | uint256 | The ID of the token |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 | The reward accrued to the NFT for the given incentive thus far |
| bonusReward | uint256 | The bonus reward accrued to the NFT for the given incentive thus far |

### collectRewards

```solidity
function collectRewards(struct IncentiveKey key, uint256 tokenId, address _owner) external returns (uint256 reward, uint256 bonusReward)
```
**Selector**: `0x046ec166`

reward amounts should be updated before calling this method

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

