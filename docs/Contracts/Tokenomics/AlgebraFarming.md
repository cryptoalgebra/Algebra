

# AlgebraFarming

## Modifiers
### isAuthorizedForToken









### onlyIncentiveMaker









### onlyOwner











## Variables
### contract INonfungiblePositionManager nonfungiblePositionManager immutable

The nonfungible position manager with which this farming contract is compatible

### contract IAlgebraPoolDeployer deployer immutable

The pool deployer with which this farming contract is compatible

### contract IVirtualPoolDeployer vdeployer immutable

The virtual pool deployer with which this farming contract is compatible

### uint256 maxIncentiveStartLeadTime immutable

The max amount of seconds into the future the incentive startTime can be set

### uint256 maxIncentiveDuration immutable

The max duration of an incentive in seconds

### mapping(bytes32 &#x3D;&gt; struct AlgebraFarming.Incentive) incentives 



*Developer note: bytes32 refers to the return value of IncentiveId.compute*
### mapping(uint256 &#x3D;&gt; struct AlgebraFarming.Deposit) deposits 



*Developer note: deposits[tokenId] &#x3D;&gt; Deposit*
### mapping(uint256 &#x3D;&gt; mapping(bytes32 &#x3D;&gt; uint128)) farms 



*Developer note: farms[tokenId][incentiveHash] &#x3D;&gt; Farm*
### mapping(contract IERC20Minimal &#x3D;&gt; mapping(address &#x3D;&gt; uint256)) rewards 

Returns amounts of reward tokens owed to a given address according to the last time all farms were updated

*Developer note: rewards[rewardToken][owner] &#x3D;&gt; uint256*

## Functions
### setIncentiveMaker

onlyOwner

`setIncentiveMaker(address)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _incentiveMaker | address |  |


### constructor

ERC721Permit

`constructor(contract IAlgebraPoolDeployer,contract INonfungiblePositionManager,contract IVirtualPoolDeployer,uint256,uint256)`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _deployer | contract IAlgebraPoolDeployer | pool deployer contract address |
| _nonfungiblePositionManager | contract INonfungiblePositionManager | the NFT position manager contract address |
| _vdeployer | contract IVirtualPoolDeployer | virtual pool deployer contract address |
| _maxIncentiveStartLeadTime | uint256 | the max duration of an incentive in seconds |
| _maxIncentiveDuration | uint256 | the max amount of seconds into the future the incentive startTime can be set |


### createIncentive

onlyIncentiveMaker

`createIncentive(struct IAlgebraFarming.IncentiveKey,uint256,uint256)`  external

Creates a new liquidity mining incentive program



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IAlgebraFarming.IncentiveKey | Details of the incentive to create |
| reward | uint256 | The amount of reward tokens to be distributed |
| bonusReward | uint256 | The amount of bonus reward tokens to be distributed |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPool | address |  |

### onERC721Received


`onERC721Received(address,address,uint256,bytes)`  external

Upon receiving a Algebra ERC721, creates the token deposit setting owner to &#x60;from&#x60;. Also farms token
in one or more incentives if properly formatted &#x60;data&#x60; has a length &gt; 0.



| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |
| from | address |  |
| tokenId | uint256 |  |
| data | bytes |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes4 |  |

### withdrawToken


`withdrawToken(uint256,address,bytes)`  external

Withdraws a Algebra LP token &#x60;tokenId&#x60; from this contract to the recipient &#x60;to&#x60;



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The unique identifier of an Algebra LP token |
| to | address | The address where the LP token will be sent |
| data | bytes | An optional data array that will be passed along to the &#x60;to&#x60; address via the NFT safeTransferFrom |


### enterFarming


`enterFarming(struct IAlgebraFarming.IncentiveKey,uint256)`  external

Farms a Algebra LP token



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IAlgebraFarming.IncentiveKey | The key of the incentive for which to farm the NFT |
| tokenId | uint256 | The ID of the token to farm |


### exitFarming

isAuthorizedForToken

`exitFarming(struct IAlgebraFarming.IncentiveKey,uint256)`  external

exitFarmings a Algebra LP token



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IAlgebraFarming.IncentiveKey | The key of the incentive for which to exitFarming the NFT |
| tokenId | uint256 | The ID of the token to exitFarming |


### claimReward


`claimReward(contract IERC20Minimal,address,uint256)`  external

Transfers &#x60;amountRequested&#x60; of accrued &#x60;rewardToken&#x60; rewards from the contract to the recipient &#x60;to&#x60;



| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardToken | contract IERC20Minimal | The token being distributed as a reward |
| to | address | The address where claimed rewards will be sent to |
| amountRequested | uint256 | The amount of reward tokens to claim. Claims entire reward amount if set to 0. |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 |  |

### getRewardInfo


`getRewardInfo(struct IAlgebraFarming.IncentiveKey,uint256)` view external

Calculates the reward amount that will be received for the given farm



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IAlgebraFarming.IncentiveKey | The key of the incentive |
| tokenId | uint256 | The ID of the token |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | uint256 |  |
| bonusReward | uint256 |  |

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


