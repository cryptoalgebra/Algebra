

# INonfungiblePositionManager

Non-fungible token for positions
Wraps Algebra positions in a non-fungible token interface which allows for them to be transferred
and authorized.


## Events
### IncreaseLiquidity


`IncreaseLiquidity(uint256,uint128,uint128,uint256,uint256,address)`  

Emitted when liquidity is increased for a position NFT



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token for which liquidity was increased |
| liquidity | uint128 | The amount by which liquidity for the NFT position was increased |
| actualLiquidity | uint128 | the actual liquidity that was added into a pool. Could differ from _liquidity_ when using FeeOnTransfer tokens |
| amount0 | uint256 | The amount of token0 that was paid for the increase in liquidity |
| amount1 | uint256 | The amount of token1 that was paid for the increase in liquidity |
| pool | address |  |


### DecreaseLiquidity


`DecreaseLiquidity(uint256,uint128,uint256,uint256)`  

Emitted when liquidity is decreased for a position NFT



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token for which liquidity was decreased |
| liquidity | uint128 | The amount by which liquidity for the NFT position was decreased |
| amount0 | uint256 | The amount of token0 that was accounted for the decrease in liquidity |
| amount1 | uint256 | The amount of token1 that was accounted for the decrease in liquidity |


### Collect


`Collect(uint256,address,uint256,uint256)`  

Emitted when tokens are collected for a position NFT



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token for which underlying tokens were collected |
| recipient | address | The address of the account that received the collected tokens |
| amount0 | uint256 | The amount of token0 owed to the position that was collected |
| amount1 | uint256 | The amount of token1 owed to the position that was collected |




## Functions
### positions


`positions(uint256)` view external

Returns the position information associated with a given token ID.



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token that represents the position |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| nonce | uint96 |  |
| operator | address |  |
| token0 | address |  |
| token1 | address |  |
| tickLower | int24 |  |
| tickUpper | int24 |  |
| liquidity | uint128 |  |
| feeGrowthInside0LastX128 | uint256 |  |
| feeGrowthInside1LastX128 | uint256 |  |
| tokensOwed0 | uint128 |  |
| tokensOwed1 | uint128 |  |

### mint


`mint(struct INonfungiblePositionManager.MintParams)` payable external

Creates a new position wrapped in a NFT



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct INonfungiblePositionManager.MintParams | The params necessary to mint a position, encoded as &#x60;MintParams&#x60; in calldata |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |
| liquidity | uint128 |  |
| amount0 | uint256 |  |
| amount1 | uint256 |  |

### increaseLiquidity


`increaseLiquidity(struct INonfungiblePositionManager.IncreaseLiquidityParams)` payable external

Increases the amount of liquidity in a position, with tokens paid by the &#x60;msg.sender&#x60;



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct INonfungiblePositionManager.IncreaseLiquidityParams | tokenId The ID of the token for which liquidity is being increased, amount0Desired The desired amount of token0 to be spent, amount1Desired The desired amount of token1 to be spent, amount0Min The minimum amount of token0 to spend, which serves as a slippage check, amount1Min The minimum amount of token1 to spend, which serves as a slippage check, deadline The time by which the transaction must be included to effect the change |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidity | uint128 |  |
| amount0 | uint256 |  |
| amount1 | uint256 |  |

### decreaseLiquidity


`decreaseLiquidity(struct INonfungiblePositionManager.DecreaseLiquidityParams)` payable external

Decreases the amount of liquidity in a position and accounts it to the position



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct INonfungiblePositionManager.DecreaseLiquidityParams | tokenId The ID of the token for which liquidity is being decreased, amount The amount by which liquidity will be decreased, amount0Min The minimum amount of token0 that should be accounted for the burned liquidity, amount1Min The minimum amount of token1 that should be accounted for the burned liquidity, deadline The time by which the transaction must be included to effect the change |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint256 |  |
| amount1 | uint256 |  |

### collect


`collect(struct INonfungiblePositionManager.CollectParams)` payable external

Collects up to a maximum amount of fees owed to a specific position to the recipient



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct INonfungiblePositionManager.CollectParams | tokenId The ID of the NFT for which tokens are being collected, recipient The account that should receive the tokens, amount0Max The maximum amount of token0 to collect, amount1Max The maximum amount of token1 to collect |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint256 |  |
| amount1 | uint256 |  |

### burn


`burn(uint256)` payable external

Burns a token ID, which deletes it from the NFT contract. The token must have 0 liquidity and all tokens
must be collected first.



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token that is being burned |




---


