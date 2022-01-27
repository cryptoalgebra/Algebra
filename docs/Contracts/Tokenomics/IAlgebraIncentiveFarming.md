

# IAlgebraIncentiveFarming




## Functions
### farms


`farms(uint256,bytes32)` view external

Returns information about a farmd liquidity NFT



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the farmd token |
| incentiveId | bytes32 | The ID of the incentive for which the token is farmd |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidity | uint128 |  |
| tickLower | int24 |  |
| tickUpper | int24 |  |

### createIncentive


`createIncentive(struct IIncentiveKey.IncentiveKey,uint256,uint256)`  external

Creates a new liquidity mining incentive program



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IIncentiveKey.IncentiveKey | Details of the incentive to create |
| reward | uint256 | The amount of reward tokens to be distributed |
| bonusReward | uint256 | The amount of bonus reward tokens to be distributed |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPool | address |  |



---


