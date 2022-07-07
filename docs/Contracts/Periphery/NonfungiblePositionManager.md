

# NonfungiblePositionManager

NFT positions
Wraps Algebra  positions in the ERC721 non-fungible token interface

## Modifiers
### isAuthorizedForToken












## Functions
### constructor

ERC721Permit, PeripheryImmutableState

`constructor(address,address,address,address)`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _factory | address |  |
| _WNativeToken | address |  |
| _tokenDescriptor_ | address |  |
| _poolDeployer | address |  |


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

checkDeadline

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

### tokenURI


`tokenURI(uint256)` view public





| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string |  |

### baseURI


`baseURI()` pure public






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string |  |

### increaseLiquidity

checkDeadline

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

isAuthorizedForToken, checkDeadline

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

isAuthorizedForToken

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

isAuthorizedForToken

`burn(uint256)` payable external

Burns a token ID, which deletes it from the NFT contract. The token must have 0 liquidity and all tokens
must be collected first.



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token that is being burned |


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


