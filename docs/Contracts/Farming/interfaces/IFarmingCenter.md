

# IFarmingCenter


Algebra main farming contract interface



*Developer note: Manages users deposits and performs entry, exit and other actions.*

**Inherits:** [IMulticall](../../Periphery/interfaces/IMulticall.md)

## Functions
### virtualPoolAddresses

```solidity
function virtualPoolAddresses(address poolAddress) external view returns (address virtualPoolAddresses)
```
**Selector**: `0x32dc5a25`

Returns current virtual pool address for Algebra pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| poolAddress | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPoolAddresses | address |  |

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

### eternalFarming

```solidity
function eternalFarming() external view returns (contract IAlgebraEternalFarming)
```
**Selector**: `0xde2356d1`

The eternal farming contract

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IAlgebraEternalFarming |  |

### algebraPoolDeployer

```solidity
function algebraPoolDeployer() external view returns (address)
```
**Selector**: `0x14258256`

The Algebra poolDeployer contract

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

### deposits

```solidity
function deposits(uint256 tokenId) external view returns (bytes32 eternalIncentiveId)
```
**Selector**: `0xb02c43d0`

Returns information about a deposited NFT

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the deposit (and token) that is being transferred |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| eternalIncentiveId | bytes32 | The id of eternal incentive that is active for this NFT |

### incentiveKeys

```solidity
function incentiveKeys(bytes32 incentiveId) external view returns (contract IERC20Minimal rewardToken, contract IERC20Minimal bonusRewardToken, contract IAlgebraPool pool, uint256 nonce)
```
**Selector**: `0x8c27f1f6`

Returns incentive key for specific incentiveId

| Name | Type | Description |
| ---- | ---- | ----------- |
| incentiveId | bytes32 | The hash of incentive key |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardToken | contract IERC20Minimal |  |
| bonusRewardToken | contract IERC20Minimal |  |
| pool | contract IAlgebraPool |  |
| nonce | uint256 |  |

### connectVirtualPoolToPlugin

```solidity
function connectVirtualPoolToPlugin(address virtualPool, contract IFarmingPlugin plugin) external
```
**Selector**: `0xd68516bc`

Used to connect incentive to compatible AlgebraPool plugin

*Developer note: only farming can do it
Will revert if something is already connected to the plugin*

| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPool | address | The virtual pool to be connected, must not be zero address |
| plugin | contract IFarmingPlugin | The Algebra farming plugin |

### disconnectVirtualPoolFromPlugin

```solidity
function disconnectVirtualPoolFromPlugin(address virtualPool, contract IFarmingPlugin plugin) external
```
**Selector**: `0x2bd34c48`

Used to disconnect incentive from compatible AlgebraPool plugin

*Developer note: only farming can do it.
If the specified virtual pool is not connected to the plugin, nothing will happen*

| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPool | address | The virtual pool to be disconnected, must not be zero address |
| plugin | contract IFarmingPlugin | The Algebra farming plugin |

### enterFarming

```solidity
function enterFarming(struct IncentiveKey key, uint256 tokenId) external
```
**Selector**: `0x5739f0b9`

Enters in incentive (eternal farming) with NFT-position token

*Developer note: msg.sender must be the owner of NFT*

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | The incentive key |
| tokenId | uint256 | The id of position NFT |

### exitFarming

```solidity
function exitFarming(struct IncentiveKey key, uint256 tokenId) external
```
**Selector**: `0x4473eca6`

Exits from incentive (eternal farming) with NFT-position token

*Developer note: msg.sender must be the owner of NFT*

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | The incentive key |
| tokenId | uint256 | The id of position NFT |

### collectRewards

```solidity
function collectRewards(struct IncentiveKey key, uint256 tokenId) external returns (uint256 reward, uint256 bonusReward)
```
**Selector**: `0x6af00aee`

Used to collect reward from eternal farming. Then reward can be claimed.

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | The incentive key |
| tokenId | uint256 | The id of position NFT |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 | The amount of collected reward |
| bonusReward | uint256 | The amount of collected bonus reward |

### claimReward

```solidity
function claimReward(contract IERC20Minimal rewardToken, address to, uint256 amountRequested) external returns (uint256 rewardBalanceBefore)
```
**Selector**: `0x2f2d783d`

Used to claim and send rewards from farming(s)

*Developer note: can be used via static call to get current rewards for user*

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardToken | contract IERC20Minimal | The token that is a reward |
| to | address | The address to be rewarded |
| amountRequested | uint256 | Amount to claim in eternal farming |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardBalanceBefore | uint256 | The total amount of unclaimed reward *before* claim |

