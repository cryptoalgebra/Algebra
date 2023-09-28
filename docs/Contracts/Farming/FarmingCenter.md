

# FarmingCenter


Algebra main farming contract



*Developer note: Manages farmings and performs entry, exit and other actions.*

**Inherits:** [IFarmingCenter](interfaces/IFarmingCenter.md) [IPositionFollower](../Periphery/interfaces/IPositionFollower.md) [Multicall](../Periphery/base/Multicall.md)
## Modifiers
### isApprovedOrOwner

```solidity
modifier isApprovedOrOwner(uint256 tokenId)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |


## Public variables
### eternalFarming
```solidity
contract IAlgebraEternalFarming immutable eternalFarming
```
**Selector**: `0xde2356d1`

The eternal farming contract


### nonfungiblePositionManager
```solidity
contract INonfungiblePositionManager immutable nonfungiblePositionManager
```
**Selector**: `0xb44a2722`

The nonfungible position manager with which this farming contract is compatible


### algebraPoolDeployer
```solidity
address immutable algebraPoolDeployer
```
**Selector**: `0x14258256`

The Algebra poolDeployer contract


### virtualPoolAddresses
```solidity
mapping(address => address) virtualPoolAddresses
```
**Selector**: `0x32dc5a25`

Returns current virtual pool address for Algebra pool


### deposits
```solidity
mapping(uint256 => bytes32) deposits
```
**Selector**: `0xb02c43d0`

Returns information about a deposited NFT


### incentiveKeys
```solidity
mapping(bytes32 => struct IncentiveKey) incentiveKeys
```
**Selector**: `0x8c27f1f6`

Returns incentive key for specific incentiveId



## Functions
### constructor

```solidity
constructor(contract IAlgebraEternalFarming _eternalFarming, contract INonfungiblePositionManager _nonfungiblePositionManager) public
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| _eternalFarming | contract IAlgebraEternalFarming |  |
| _nonfungiblePositionManager | contract INonfungiblePositionManager |  |

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

### applyLiquidityDelta

```solidity
function applyLiquidityDelta(uint256 tokenId, int256) external
```
**Selector**: `0x06e65c90`

Report a change of liquidity in position

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token for which liquidity is being added |
|  | int256 |  |

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
function claimReward(contract IERC20Minimal rewardToken, address to, uint256 amountRequested) external returns (uint256 reward)
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
| reward | uint256 | The summary amount of claimed rewards |

### connectVirtualPoolToPlugin

```solidity
function connectVirtualPoolToPlugin(address newVirtualPool, contract IFarmingPlugin plugin) external
```
**Selector**: `0xd68516bc`

Used to connect incentive to compatible AlgebraPool plugin

*Developer note: only farming can do it
Will revert if something is already connected to the plugin*

| Name | Type | Description |
| ---- | ---- | ----------- |
| newVirtualPool | address |  |
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

