

# IAlgebraPoolPermissionedActions

Permissioned pool actions
Contains pool methods that may only be called by permissioned addresses
*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces*




## Functions
# setCommunityFee


`function setCommunityFee(uint8 communityFee) external`  external

Set the community&#x27;s % share of the fees. Cannot exceed 25% (250). Only factory owner or POOLS_ADMINISTRATOR_ROLE role



| Name | Type | Description |
| ---- | ---- | ----------- |
| communityFee | uint8 | new community fee percent in thousandths (1e-3) |


# setTickSpacing


`function setTickSpacing(int24 newTickSpacing, int24 newTickSpacingLimitOrders) external`  external

Set the new tick spacing values. Only factory owner or POOLS_ADMINISTRATOR_ROLE role



| Name | Type | Description |
| ---- | ---- | ----------- |
| newTickSpacing | int24 | The new tick spacing value |
| newTickSpacingLimitOrders | int24 | The new tick spacing value for limit orders |


# setIncentive


`function setIncentive(address newIncentiveAddress) external`  external

Sets an active incentive. Only farming



| Name | Type | Description |
| ---- | ---- | ----------- |
| newIncentiveAddress | address | The address associated with the incentive |




---


