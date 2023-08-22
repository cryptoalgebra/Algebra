

# FarmingCenter


Algebra main farming contract



*Developer note: Manages farmings and performs entry, exit and other actions.*

## Modifiers
### isOwner

```solidity
modifier isOwner(uint256 tokenId)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |


## Variables
### contract IAlgebraEternalFarming eternalFarming immutable

The eternal farming contract


### contract INonfungiblePositionManager nonfungiblePositionManager immutable

The nonfungible position manager with which this farming contract is compatible


### address algebraPoolDeployer immutable

The Algebra poolDeployer contract


### mapping(address &#x3D;&gt; address) virtualPoolAddresses 



*Developer note: saves addresses of virtual pools for pool*

### mapping(uint256 &#x3D;&gt; bytes32) deposits 



*Developer note: deposits[tokenId] &#x3D;&gt; incentiveId*

### mapping(bytes32 &#x3D;&gt; struct IncentiveKey) incentiveKeys 





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

Enters in incentive (time-limited or eternal farming) with NFT-position token

*Developer note: token must be deposited in FarmingCenter*

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | The incentive event key |
| tokenId | uint256 | The id of position NFT |

### exitFarming

```solidity
function exitFarming(struct IncentiveKey key, uint256 tokenId) external
```

Exits from incentive (time-limited or eternal farming) with NFT-position token

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | The incentive event key |
| tokenId | uint256 | The id of position NFT |

### applyLiquidityDelta

```solidity
function applyLiquidityDelta(uint256 tokenId, int256 liquidityDelta) external
```

Report a change of liquidity in position

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token for which liquidity is being added |
| liquidityDelta | int256 | The amount of added liquidity |

### collectRewards

```solidity
function collectRewards(struct IncentiveKey key, uint256 tokenId) external returns (uint256 reward, uint256 bonusReward)
```

Used to collect reward from eternal farming. Then reward can be claimed.

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IncentiveKey | The incentive event key |
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
function connectVirtualPoolToPlugin(contract IFarmingPlugin plugin, address newVirtualPool) external
```

Updates incentive in AlgebraPool plugin

*Developer note: only farming can do it*

| Name | Type | Description |
| ---- | ---- | ----------- |
| plugin | contract IFarmingPlugin | The Algebra farming plugin |
| newVirtualPool | address |  |
