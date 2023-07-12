

# PoolMockEchidna










## Functions
### donate


`function donate(uint256 amount0, uint256 amount1) public`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint256 |  |
| amount1 | uint256 |  |


### mintWrapped


`function mintWrapped(int24 bottomTick, int24 topTick, uint128 liquidityDesired, uint256 pay0, uint256 pay1) public`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 |  |
| topTick | int24 |  |
| liquidityDesired | uint128 |  |
| pay0 | uint256 |  |
| pay1 | uint256 |  |


### mintAroundCurrentTickWrapped


`function mintAroundCurrentTickWrapped(int24 tickDelta, uint128 liquidityDesired, uint256 pay0, uint256 pay1) public`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| tickDelta | int24 |  |
| liquidityDesired | uint128 |  |
| pay0 | uint256 |  |
| pay1 | uint256 |  |


### burnLastMintedPosition


`function burnLastMintedPosition(uint128 liquidityDelta) public`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidityDelta | uint128 |  |


### collectLastMintedPosition


`function collectLastMintedPosition(uint128 amount0Requested, uint128 amount1Requested) public`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0Requested | uint128 |  |
| amount1Requested | uint128 |  |


### flashWrapped


`function flashWrapped(address recipient, uint256 amount0, uint256 amount1) public`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address |  |
| amount0 | uint256 |  |
| amount1 | uint256 |  |


### swapSupportingFeeOnInputTokensWrapped


`function swapSupportingFeeOnInputTokensWrapped(bool zeroToOne, int256 amountRequired, uint160 limitSqrtPrice, uint256 pay0, uint256 pay1) public`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| zeroToOne | bool |  |
| amountRequired | int256 |  |
| limitSqrtPrice | uint160 |  |
| pay0 | uint256 |  |
| pay1 | uint256 |  |


### hasRoleOrOwner


`function hasRoleOrOwner(bytes32, address) public pure returns (bool)` pure public





| Name | Type | Description |
| ---- | ---- | ----------- |
|  | bytes32 |  |
|  | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |




