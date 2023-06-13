

# IAlgebraPoolPermissionedActions


Permissioned pool actions

Contains pool methods that may only be called by the factory owner or tokenomics

*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces*




## Functions
### setCommunityFee


`function setCommunityFee(uint8 communityFee0, uint8 communityFee1) external`  external

Set the community&#x27;s % share of the fees. Cannot exceed 25% (250)



| Name | Type | Description |
| ---- | ---- | ----------- |
| communityFee0 | uint8 | new community fee percent for token0 of the pool in thousandths (1e-3) |
| communityFee1 | uint8 | new community fee percent for token1 of the pool in thousandths (1e-3) |


### setTickSpacing


`function setTickSpacing(int24 newTickSpacing) external`  external

Set the new tick spacing values. Only factory owner



| Name | Type | Description |
| ---- | ---- | ----------- |
| newTickSpacing | int24 | The new tick spacing value |


### setIncentive


`function setIncentive(address virtualPoolAddress) external`  external

Sets an active incentive



| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPoolAddress | address | The address of a virtual pool associated with the incentive |


### setLiquidityCooldown


`function setLiquidityCooldown(uint32 newLiquidityCooldown) external`  external

Sets new lock time for added liquidity



| Name | Type | Description |
| ---- | ---- | ----------- |
| newLiquidityCooldown | uint32 | The time in seconds |





