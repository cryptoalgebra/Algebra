

# AlgebraFarming

Abstract base contract for Algebra farmings


## Modifiers
### onlyIncentiveMaker









### onlyOwner









### onlyFarmingCenter











## Variables
### contract INonfungiblePositionManager nonfungiblePositionManager immutable

The nonfungible position manager with which this farming contract is compatible

### contract IAlgebraPoolDeployer deployer immutable

The pool deployer

### contract IFarmingCenter farmingCenter 

The farming Center

### mapping(bytes32 &#x3D;&gt; struct AlgebraFarming.Incentive) incentives 

Represents a farming incentive

*Developer note: bytes32 refers to the return value of IncentiveId.compute*
### mapping(address &#x3D;&gt; mapping(contract IERC20Minimal &#x3D;&gt; uint256)) rewards 

Returns amounts of reward tokens owed to a given address according to the last time all farms were updated

*Developer note: rewards[owner][rewardToken] &#x3D;&gt; uint256*

## Functions
### setIncentiveMaker

onlyOwner

`setIncentiveMaker(address)`  external

Updates the incentive maker



| Name | Type | Description |
| ---- | ---- | ----------- |
| _incentiveMaker | address | The new incentive maker address |


### setFarmingCenterAddress

onlyOwner

`setFarmingCenterAddress(address)`  external

Updates farming center address



| Name | Type | Description |
| ---- | ---- | ----------- |
| _farmingCenter | address | The new farming center contract address |


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

### claimRewardFrom

onlyFarmingCenter

`claimRewardFrom(contract IERC20Minimal,address,address,uint256)`  external

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
| reward | uint256 |  |



---


