

# IPositionFollower


Contract tracking liquidity position

Using these methods farmingCenter receives information about changes in the positions


## Functions
### applyLiquidityDelta

```solidity
function applyLiquidityDelta(uint256 tokenId, int256 liquidityDelta) external
```
**Selector**: `0x06e65c90`

Report a change of liquidity in position

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token for which liquidity is being added |
| liquidityDelta | int256 | The amount of added liquidity |

