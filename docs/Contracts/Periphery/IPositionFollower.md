

# IPositionFollower

Contract tracking liquidity position
Using these methods farmingCenter receives information about changes in the positions




## Functions
# applyLiquidityDelta


`function applyLiquidityDelta(uint256 tokenId, int256 liquidityDelta) external`  external

Report a change of liquidity in position



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token for which liquidity is being added |
| liquidityDelta | int256 | The amount of added liquidity |


# burnPosition


`function burnPosition(uint256 tokenId) external returns (bool)`  external

Report a burn of position token



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token which is being burned |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |



---


