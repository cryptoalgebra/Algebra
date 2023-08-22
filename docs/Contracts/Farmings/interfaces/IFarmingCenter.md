

# IFarmingCenter







## Functions
### virtualPoolAddresses

```solidity
function virtualPoolAddresses(address) external view returns (address)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

### nonfungiblePositionManager

```solidity
function nonfungiblePositionManager() external view returns (contract INonfungiblePositionManager)
```

The nonfungible position manager with which this farming contract is compatible

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract INonfungiblePositionManager |  |

### eternalFarming

```solidity
function eternalFarming() external view returns (contract IAlgebraEternalFarming)
```

The eternal farming contract

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IAlgebraEternalFarming |  |

### algebraPoolDeployer

```solidity
function algebraPoolDeployer() external view returns (address)
```

The Algebra poolDeployer contract

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

### deposits

```solidity
function deposits(uint256 tokenId) external view returns (bytes32 eternalIncentiveId)
```

Returns information about a deposited NFT

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the deposit (and token) that is being transferred |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| eternalIncentiveId | bytes32 | The id of eternal incentive that is active for this NFT |

### connectVirtualPoolToPlugin

```solidity
function connectVirtualPoolToPlugin(contract IFarmingPlugin plugin, address virtualPool) external
```

Updates incentive in AlgebraPool plugin

*Developer note: only farming can do it*

| Name | Type | Description |
| ---- | ---- | ----------- |
| plugin | contract IFarmingPlugin | The Algebra farming plugin |
| virtualPool | address | The virtual pool to be connected |

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

