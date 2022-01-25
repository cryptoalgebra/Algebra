

# ERC165




## Functions
#### supportsInterface view public


`supportsInterface(bytes4)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| interfaceId | bytes4 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |



---




# IERC165




## Functions
#### supportsInterface view external


`supportsInterface(bytes4)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| interfaceId | bytes4 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |



---








# IERC20


## Events
#### Transfer  


`Transfer(address,address,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address |  |
| to | address |  |
| value | uint256 |  |


#### Approval  


`Approval(address,address,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| spender | address |  |
| value | uint256 |  |




## Functions
#### totalSupply view external


`totalSupply()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

#### balanceOf view external


`balanceOf(address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

#### transfer  external


`transfer(address,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address |  |
| amount | uint256 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

#### allowance view external


`allowance(address,address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| spender | address |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

#### approve  external


`approve(address,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address |  |
| amount | uint256 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

#### transferFrom  external


`transferFrom(address,address,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address |  |
| recipient | address |  |
| amount | uint256 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |



---






# ERC721




## Functions
#### constructor  public


`constructor(string,string)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| name_ | string |  |
| symbol_ | string |  |


#### balanceOf view public


`balanceOf(address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

#### ownerOf view public


`ownerOf(uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

#### name view public


`name()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string |  |

#### symbol view public


`symbol()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string |  |

#### tokenURI view public


`tokenURI(uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string |  |

#### baseURI view public


`baseURI()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string |  |

#### tokenOfOwnerByIndex view public


`tokenOfOwnerByIndex(address,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| index | uint256 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

#### totalSupply view public


`totalSupply()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

#### tokenByIndex view public


`tokenByIndex(uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint256 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

#### approve  public


`approve(address,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address |  |
| tokenId | uint256 |  |


#### getApproved view public


`getApproved(uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

#### setApprovalForAll  public


`setApprovalForAll(address,bool)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| operator | address |  |
| approved | bool |  |


#### isApprovedForAll view public


`isApprovedForAll(address,address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| operator | address |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

#### transferFrom  public


`transferFrom(address,address,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address |  |
| to | address |  |
| tokenId | uint256 |  |


#### safeTransferFrom  public


`safeTransferFrom(address,address,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address |  |
| to | address |  |
| tokenId | uint256 |  |


#### safeTransferFrom  public


`safeTransferFrom(address,address,uint256,bytes)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address |  |
| to | address |  |
| tokenId | uint256 |  |
| _data | bytes |  |




---




# IERC721


## Events
#### Transfer  


`Transfer(address,address,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address |  |
| to | address |  |
| tokenId | uint256 |  |


#### Approval  


`Approval(address,address,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| approved | address |  |
| tokenId | uint256 |  |


#### ApprovalForAll  


`ApprovalForAll(address,address,bool)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| operator | address |  |
| approved | bool |  |




## Functions
#### balanceOf view external


`balanceOf(address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| balance | uint256 |  |

#### ownerOf view external


`ownerOf(uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |

#### safeTransferFrom  external


`safeTransferFrom(address,address,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address |  |
| to | address |  |
| tokenId | uint256 |  |


#### transferFrom  external


`transferFrom(address,address,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address |  |
| to | address |  |
| tokenId | uint256 |  |


#### approve  external


`approve(address,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address |  |
| tokenId | uint256 |  |


#### getApproved view external


`getApproved(uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| operator | address |  |

#### setApprovalForAll  external


`setApprovalForAll(address,bool)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| operator | address |  |
| _approved | bool |  |


#### isApprovedForAll view external


`isApprovedForAll(address,address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| operator | address |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

#### safeTransferFrom  external


`safeTransferFrom(address,address,uint256,bytes)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address |  |
| to | address |  |
| tokenId | uint256 |  |
| data | bytes |  |




---




# IERC721Enumerable




## Functions
#### totalSupply view external


`totalSupply()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

#### tokenOfOwnerByIndex view external


`tokenOfOwnerByIndex(address,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| index | uint256 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |

#### tokenByIndex view external


`tokenByIndex(uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint256 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |



---




# IERC721Metadata




## Functions
#### name view external


`name()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string |  |

#### symbol view external


`symbol()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string |  |

#### tokenURI view external


`tokenURI(uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string |  |



---




# IERC721Receiver




## Functions
#### onERC721Received  external


`onERC721Received(address,address,uint256,bytes)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| operator | address |  |
| from | address |  |
| tokenId | uint256 |  |
| data | bytes |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes4 |  |



---
















# ERC721Permit



## Variables
#### bytes32 PERMIT_TYPEHASH constant

The permit typehash used in the permit signature

*Developer note: Value is equal to keccak256(&quot;Permit(address spender,uint256 tokenId,uint256 nonce,uint256 deadline)&quot;);*

## Functions
#### DOMAIN_SEPARATOR view public


`DOMAIN_SEPARATOR()`

The domain separator used in the permit signature




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32 |  |

#### permit payable external


`permit(address,uint256,uint256,uint8,bytes32,bytes32)`

Approve of a specific token ID for spending by spender via signature



| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address | The account that is being approved |
| tokenId | uint256 | The ID of the token that is being approved for spending |
| deadline | uint256 | The deadline timestamp by which the call must be mined for the approve to work |
| v | uint8 | Must produce valid secp256k1 signature from the holder along with &#x60;r&#x60; and &#x60;s&#x60; |
| r | bytes32 | Must produce valid secp256k1 signature from the holder along with &#x60;v&#x60; and &#x60;s&#x60; |
| s | bytes32 | Must produce valid secp256k1 signature from the holder along with &#x60;r&#x60; and &#x60;v&#x60; |




---




# Multicall




## Functions
#### multicall payable external


`multicall(bytes[])`

Call multiple functions in the current contract and return the data from all of them if they all succeed



| Name | Type | Description |
| ---- | ---- | ----------- |
| data | bytes[] | The encoded function data for each of the calls to make to this contract |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| results | bytes[] |  |



---




# IERC721Permit




## Functions
#### PERMIT_TYPEHASH pure external


`PERMIT_TYPEHASH()`

The permit typehash used in the permit signature




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32 |  |

#### DOMAIN_SEPARATOR view external


`DOMAIN_SEPARATOR()`

The domain separator used in the permit signature




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32 |  |

#### permit payable external


`permit(address,uint256,uint256,uint8,bytes32,bytes32)`

Approve of a specific token ID for spending by spender via signature



| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address | The account that is being approved |
| tokenId | uint256 | The ID of the token that is being approved for spending |
| deadline | uint256 | The deadline timestamp by which the call must be mined for the approve to work |
| v | uint8 | Must produce valid secp256k1 signature from the holder along with &#x60;r&#x60; and &#x60;s&#x60; |
| r | bytes32 | Must produce valid secp256k1 signature from the holder along with &#x60;v&#x60; and &#x60;s&#x60; |
| s | bytes32 | Must produce valid secp256k1 signature from the holder along with &#x60;r&#x60; and &#x60;v&#x60; |




---




# IMulticall




## Functions
#### multicall payable external


`multicall(bytes[])`

Call multiple functions in the current contract and return the data from all of them if they all succeed



| Name | Type | Description |
| ---- | ---- | ----------- |
| data | bytes[] | The encoded function data for each of the calls to make to this contract |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| results | bytes[] |  |



---




# INonfungiblePositionManager


## Events
#### IncreaseLiquidity  


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


#### DecreaseLiquidity  


`DecreaseLiquidity(uint256,uint128,uint256,uint256)`

Emitted when liquidity is decreased for a position NFT



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token for which liquidity was decreased |
| liquidity | uint128 | The amount by which liquidity for the NFT position was decreased |
| amount0 | uint256 | The amount of token0 that was accounted for the decrease in liquidity |
| amount1 | uint256 | The amount of token1 that was accounted for the decrease in liquidity |


#### Collect  


`Collect(uint256,address,uint256,uint256)`

Emitted when tokens are collected for a position NFT



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token for which underlying tokens were collected |
| recipient | address | The address of the account that received the collected tokens |
| amount0 | uint256 | The amount of token0 owed to the position that was collected |
| amount1 | uint256 | The amount of token1 owed to the position that was collected |




## Functions
#### positions view external


`positions(uint256)`

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

#### mint payable external


`mint(struct INonfungiblePositionManager.MintParams)`

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

#### increaseLiquidity payable external


`increaseLiquidity(struct INonfungiblePositionManager.IncreaseLiquidityParams)`

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

#### decreaseLiquidity payable external


`decreaseLiquidity(struct INonfungiblePositionManager.DecreaseLiquidityParams)`

Decreases the amount of liquidity in a position and accounts it to the position



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct INonfungiblePositionManager.DecreaseLiquidityParams | tokenId The ID of the token for which liquidity is being decreased, amount The amount by which liquidity will be decreased, amount0Min The minimum amount of token0 that should be accounted for the burned liquidity, amount1Min The minimum amount of token1 that should be accounted for the burned liquidity, deadline The time by which the transaction must be included to effect the change |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint256 |  |
| amount1 | uint256 |  |

#### collect payable external


`collect(struct INonfungiblePositionManager.CollectParams)`

Collects up to a maximum amount of fees owed to a specific position to the recipient



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct INonfungiblePositionManager.CollectParams | tokenId The ID of the NFT for which tokens are being collected, recipient The account that should receive the tokens, amount0Max The maximum amount of token0 to collect, amount1Max The maximum amount of token1 to collect |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint256 |  |
| amount1 | uint256 |  |

#### burn payable external


`burn(uint256)`

Burns a token ID, which deletes it from the NFT contract. The token must have 0 liquidity and all tokens
must be collected first.



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the token that is being burned |




---




# IPeripheryImmutableState




## Functions
#### factory view external


`factory()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

#### poolDeployer view external


`poolDeployer()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

#### WNativeToken view external


`WNativeToken()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |



---




# IPeripheryPayments




## Functions
#### unwrapWNativeToken payable external


`unwrapWNativeToken(uint256,address)`

Unwraps the contract&#x27;s WNativeToken balance and sends it to recipient as NativeToken.



| Name | Type | Description |
| ---- | ---- | ----------- |
| amountMinimum | uint256 | The minimum amount of WNativeToken to unwrap |
| recipient | address | The address receiving NativeToken |


#### refundNativeToken payable external


`refundNativeToken()`

Refunds any NativeToken balance held by this contract to the &#x60;msg.sender&#x60;





#### sweepToken payable external


`sweepToken(address,uint256,address)`

Transfers the full amount of a token held by this contract to recipient



| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | The contract address of the token which will be transferred to &#x60;recipient&#x60; |
| amountMinimum | uint256 | The minimum amount of token required for a transfer |
| recipient | address | The destination address of the token |




---




# IPoolInitializer




## Functions
#### createAndInitializePoolIfNecessary payable external


`createAndInitializePoolIfNecessary(address,address,uint160)`

Creates a new pool if it does not exist, then initializes if not initialized



| Name | Type | Description |
| ---- | ---- | ----------- |
| token0 | address | The contract address of token0 of the pool |
| token1 | address | The contract address of token1 of the pool |
| sqrtPriceX96 | uint160 | The initial square root price of the pool as a Q64.96 value |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address |  |



---




# ISwapRouter




## Functions
#### exactInputSingle payable external


`exactInputSingle(struct ISwapRouter.ExactInputSingleParams)`

Swaps &#x60;amountIn&#x60; of one token for as much as possible of another token



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct ISwapRouter.ExactInputSingleParams | The parameters necessary for the swap, encoded as &#x60;ExactInputSingleParams&#x60; in calldata |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| amountOut | uint256 |  |

#### exactInput payable external


`exactInput(struct ISwapRouter.ExactInputParams)`

Swaps &#x60;amountIn&#x60; of one token for as much as possible of another along the specified path



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct ISwapRouter.ExactInputParams | The parameters necessary for the multi-hop swap, encoded as &#x60;ExactInputParams&#x60; in calldata |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| amountOut | uint256 |  |

#### exactOutputSingle payable external


`exactOutputSingle(struct ISwapRouter.ExactOutputSingleParams)`

Swaps as little as possible of one token for &#x60;amountOut&#x60; of another token



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct ISwapRouter.ExactOutputSingleParams | The parameters necessary for the swap, encoded as &#x60;ExactOutputSingleParams&#x60; in calldata |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| amountIn | uint256 |  |

#### exactOutput payable external


`exactOutput(struct ISwapRouter.ExactOutputParams)`

Swaps as little as possible of one token for &#x60;amountOut&#x60; of another along the specified path (reversed)



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct ISwapRouter.ExactOutputParams | The parameters necessary for the multi-hop swap, encoded as &#x60;ExactOutputParams&#x60; in calldata |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| amountIn | uint256 |  |

#### exactInputSingleSupportingFeeOnTransferTokens  external


`exactInputSingleSupportingFeeOnTransferTokens(struct ISwapRouter.ExactInputSingleParams)`

Swaps &#x60;amountIn&#x60; of one token for as much as possible of another along the specified path



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct ISwapRouter.ExactInputSingleParams | The parameters necessary for the multi-hop swap, encoded as &#x60;ExactInputParams&#x60; in calldata |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| amountOut | uint256 |  |



---




# IERC1271




## Functions
#### isValidSignature view external


`isValidSignature(bytes32,bytes)`

Returns whether the provided signature is valid for the provided data



| Name | Type | Description |
| ---- | ---- | ----------- |
| hash | bytes32 | Hash of the data to be signed |
| signature | bytes | Signature byte array associated with _data |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| magicValue | bytes4 |  |



---










# IAlgebraFactory


## Events
#### OwnerChanged  


`OwnerChanged(address,address)`

Emitted when the owner of the factory is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| oldOwner | address | The owner before the owner was changed |
| newOwner | address | The owner after the owner was changed |


#### VaultAddressChanged  


`VaultAddressChanged(address,address)`

Emitted when the vault address is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| vaultAddress | address | The vault address before the address was changed |
| _vaultAddress | address | The vault address after the address was changed |


#### PoolCreated  


`PoolCreated(address,address,address)`

Emitted when a pool is created



| Name | Type | Description |
| ---- | ---- | ----------- |
| token0 | address | The first token of the pool by address sort order |
| token1 | address | The second token of the pool by address sort order |
| pool | address | The address of the created pool |


#### FarmingAddressChanged  


`FarmingAddressChanged(address,address)`

Emitted when the farming address is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| farmingAddress | address | The farming address before the address was changed |
| _farmingAddress | address | The farming address after the address was changed |




## Functions
#### owner view external


`owner()`

Returns the current owner of the factory




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

#### poolDeployer view external


`poolDeployer()`

Returns the current poolDeployerAddress




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

#### farmingAddress view external


`farmingAddress()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

#### vaultAddress view external


`vaultAddress()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

#### poolByPair view external


`poolByPair(address,address)`

Returns the pool address for a given pair of tokens and a fee, or address 0 if it does not exist



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenA | address | The contract address of either token0 or token1 |
| tokenB | address | The contract address of the other token |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address |  |

#### createPool  external


`createPool(address,address)`

Creates a pool for the given two tokens and fee



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenA | address | One of the two tokens in the desired pool |
| tokenB | address | The other of the two tokens in the desired pool |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address |  |

#### setOwner  external


`setOwner(address)`

Updates the owner of the factory



| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | The new owner of the factory |


#### setFarmingAddress  external


`setFarmingAddress(address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _farmingAddress | address | The new tokenomics contract address |


#### setVaultAddress  external


`setVaultAddress(address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _vaultAddress | address |  |


#### isPaused  external


`isPaused()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

#### isPauseForbidden  external


`isPauseForbidden()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

#### setBaseFeeConfiguration  external


`setBaseFeeConfiguration(uint32,uint32,uint32,uint32,uint16,uint16,uint32,uint32,uint16)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| alpha1 | uint32 |  |
| alpha2 | uint32 |  |
| beta1 | uint32 |  |
| beta2 | uint32 |  |
| gamma1 | uint16 |  |
| gamma2 | uint16 |  |
| volumeBeta | uint32 |  |
| volumeGamma | uint32 |  |
| baseFee | uint16 |  |




---






# IAlgebraPoolDeployer


## Events
#### FactoryChanged  


`FactoryChanged(address,address)`

Emitted when the factory address is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| factory | address | The factory address before the address was changed |
| _factory | address | The factory address after the address was changed |




## Functions
#### parameters view external


`parameters()`

Get the parameters to be used in constructing the pool, set transiently during pool creation.




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| dataStorage | address |  |
| factory | address |  |
| token0 | address |  |
| token1 | address |  |

#### deploy  external


`deploy(address,address,address,address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| dataStorage | address | The pools associated dataStorage |
| factory | address | The contract address of the Algebra factory |
| token0 | address | The first token of the pool by address sort order |
| token1 | address | The second token of the pool by address sort order |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address |  |

#### setFactory  external


`setFactory(address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| factory | address | The address of the Algebra factory |




---




# IAlgebraVirtualPool




## Functions
#### cross  external


`cross(int24,bool)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| nextTick | int24 | The crossed tick |
| zeroForOne | bool | The direction |


#### processSwap  external


`processSwap()`







#### increaseCumulative  external


`increaseCumulative(uint32)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| currentTimestamp | uint32 | The timestamp of the current swap |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | enum IAlgebraVirtualPool.Status |  |



---




# IDataStorageOperator




## Functions
#### timepoints view external


`timepoints(uint256)`

Returns data belonging to a certain timepoint



| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint256 | The index of timepoint in the array |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| initialized | bool |  |
| blockTimestamp | uint32 |  |
| tickCumulative | int56 |  |
| secondsPerLiquidityCumulative | uint160 |  |
| volatilityCumulative | uint88 |  |
| averageTick | int24 |  |
| volumePerLiquidityCumulative | uint144 |  |

#### initialize  external


`initialize(uint32,int24)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 |  |
| tick | int24 |  |


#### getSingleTimepoint view external


`getSingleTimepoint(uint32,uint32,int24,uint16,uint128)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 |  |
| secondsAgo | uint32 |  |
| tick | int24 |  |
| index | uint16 |  |
| liquidity | uint128 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulative | int56 |  |
| secondsPerLiquidityCumulative | uint160 |  |
| volatilityCumulative | uint112 |  |
| volumePerAvgLiquidity | uint256 |  |

#### getTimepoints view external


`getTimepoints(uint32,uint32[],int24,uint16,uint128)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 |  |
| secondsAgos | uint32[] |  |
| tick | int24 |  |
| index | uint16 |  |
| liquidity | uint128 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulatives | int56[] |  |
| secondsPerLiquidityCumulatives | uint160[] |  |
| volatilityCumulatives | uint112[] |  |
| volumePerAvgLiquiditys | uint256[] |  |

#### getAverages view external


`getAverages(uint32,int24,uint16,uint128)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| time | uint32 |  |
| tick | int24 |  |
| index | uint16 |  |
| liquidity | uint128 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| TWVolatilityAverage | uint112 |  |
| TWVolumePerLiqAverage | uint256 |  |

#### write  external


`write(uint16,uint32,int24,uint128,uint128)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint16 |  |
| blockTimestamp | uint32 |  |
| tick | int24 |  |
| liquidity | uint128 |  |
| volumePerLiquidity | uint128 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| indexUpdated | uint16 |  |

#### changeFeeConfiguration  external


`changeFeeConfiguration(uint32,uint32,uint32,uint32,uint16,uint16,uint32,uint32,uint16)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| alpha1 | uint32 |  |
| alpha2 | uint32 |  |
| beta1 | uint32 |  |
| beta2 | uint32 |  |
| gamma1 | uint16 |  |
| gamma2 | uint16 |  |
| volumeBeta | uint32 |  |
| volumeGamma | uint32 |  |
| baseFee | uint16 |  |


#### calculateVolumePerLiquidity pure external


`calculateVolumePerLiquidity(uint128,int256,int256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidity | uint128 |  |
| amount0 | int256 |  |
| amount1 | int256 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| volumePerLiquidity | uint128 |  |

#### WINDOW view external


`WINDOW()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

#### getFee view external


`getFee(uint32,int24,uint16,uint128)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _time | uint32 |  |
| _tick | int24 |  |
| _index | uint16 |  |
| _liquidity | uint128 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| fee | uint16 |  |



---




# IERC20Minimal


## Events
#### Transfer  


`Transfer(address,address,uint256)`

Event emitted when tokens are transferred from one address to another, either via &#x60;#transfer&#x60; or &#x60;#transferFrom&#x60;.



| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | The account from which the tokens were sent, i.e. the balance decreased |
| to | address | The account to which the tokens were sent, i.e. the balance increased |
| value | uint256 | The amount of tokens that were transferred |


#### Approval  


`Approval(address,address,uint256)`

Event emitted when the approval amount for the spender of a given owner&#x27;s tokens changes.



| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The account that approved spending of its tokens |
| spender | address | The account for which the spending allowance was modified |
| value | uint256 | The new allowance from the owner to the spender |




## Functions
#### balanceOf view external


`balanceOf(address)`

Returns the balance of a token



| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | The account for which to look up the number of tokens it has, i.e. its balance |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

#### transfer  external


`transfer(address,uint256)`

Transfers the amount of token from the &#x60;msg.sender&#x60; to the recipient



| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | The account that will receive the amount transferred |
| amount | uint256 | The number of tokens to send from the sender to the recipient |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

#### allowance view external


`allowance(address,address)`

Returns the current allowance given to a spender by an owner



| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The account of the token owner |
| spender | address | The account of the token spender |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

#### approve  external


`approve(address,uint256)`

Sets the allowance of a spender from the &#x60;msg.sender&#x60; to the value &#x60;amount&#x60;



| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address | The account which will be allowed to spend a given amount of the owners tokens |
| amount | uint256 | The amount of tokens allowed to be used by &#x60;spender&#x60; |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

#### transferFrom  external


`transferFrom(address,address,uint256)`

Transfers &#x60;amount&#x60; tokens from &#x60;sender&#x60; to &#x60;recipient&#x60; up to the allowance given to the &#x60;msg.sender&#x60;



| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The account from which the transfer will be initiated |
| recipient | address | The recipient of the transfer |
| amount | uint256 | The amount of the transfer |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |



---




# IAlgebraSwapCallback




## Functions
#### AlgebraSwapCallback  external


`AlgebraSwapCallback(int256,int256,bytes)`

Called to &#x60;msg.sender&#x60; after executing a swap via IAlgebraPool#swap.



| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0Delta | int256 | The amount of token0 that was sent (negative) or must be received (positive) by the pool by the end of the swap. If positive, the callback must send that amount of token0 to the pool. |
| amount1Delta | int256 | The amount of token1 that was sent (negative) or must be received (positive) by the pool by the end of the swap. If positive, the callback must send that amount of token1 to the pool. |
| data | bytes | Any data passed through by the caller via the IAlgebraPoolActions#swap call |




---




# IAlgebraPoolActions




## Functions
#### initialize  external


`initialize(uint160)`

Sets the initial price for the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| price | uint160 | the initial sqrt price of the pool as a Q64.96 |


#### mint  external


`mint(address,address,int24,int24,uint128,bytes)`

Adds liquidity for the given recipient/bottomTick/topTick position



| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address |  |
| recipient | address | The address for which the liquidity will be created |
| bottomTick | int24 | The lower tick of the position in which to add liquidity |
| topTick | int24 | The upper tick of the position in which to add liquidity |
| amount | uint128 | The amount of liquidity to mint |
| data | bytes | Any data that should be passed through to the callback |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint256 |  |
| amount1 | uint256 |  |
| liquidityAmount | uint256 |  |

#### collect  external


`collect(address,int24,int24,uint128,uint128)`

Collects tokens owed to a position



| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | The address which should receive the fees collected |
| bottomTick | int24 | The lower tick of the position for which to collect fees |
| topTick | int24 | The upper tick of the position for which to collect fees |
| amount0Requested | uint128 | How much token0 should be withdrawn from the fees owed |
| amount1Requested | uint128 | How much token1 should be withdrawn from the fees owed |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint128 |  |
| amount1 | uint128 |  |

#### burn  external


`burn(int24,int24,uint128)`

Burn liquidity from the sender and account tokens owed for the liquidity to the position



| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 | The lower tick of the position for which to burn liquidity |
| topTick | int24 | The upper tick of the position for which to burn liquidity |
| amount | uint128 | How much liquidity to burn |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint256 |  |
| amount1 | uint256 |  |

#### swap  external


`swap(address,bool,int256,uint160,bytes)`

Swap token0 for token1, or token1 for token0



| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | The address to receive the output of the swap |
| zeroForOne | bool | The direction of the swap, true for token0 to token1, false for token1 to token0 |
| amountSpecified | int256 | The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative) |
| limitSqrtPrice | uint160 | The Q64.96 sqrt price limit. If zero for one, the price cannot be less than this value after the swap. If one for zero, the price cannot be greater than this value after the swap |
| data | bytes | Any data to be passed through to the callback. If using the Router it should contain SwapRouter#SwapCallbackData |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | int256 |  |
| amount1 | int256 |  |

#### swapSupportingFeeOnInputTokens  external


`swapSupportingFeeOnInputTokens(address,address,bool,int256,uint160,bytes)`

Swap token0 for token1, or token1 for token0 (tokens that have fee on transfer)



| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The address called this function (Comes from the Router) |
| recipient | address | The address to receive the output of the swap |
| zeroForOne | bool | The direction of the swap, true for token0 to token1, false for token1 to token0 |
| amountSpecified | int256 | The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative) |
| limitSqrtPrice | uint160 | The Q64.96 sqrt price limit. If zero for one, the price cannot be less than this value after the swap. If one for zero, the price cannot be greater than this value after the swap |
| data | bytes | Any data to be passed through to the callback. If using the Router it should contain SwapRouter#SwapCallbackData |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | int256 |  |
| amount1 | int256 |  |

#### flash  external


`flash(address,uint256,uint256,bytes)`

Receive token0 and/or token1 and pay it back, plus a fee, in the callback



| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | The address which will receive the token0 and token1 amounts |
| amount0 | uint256 | The amount of token0 to send |
| amount1 | uint256 | The amount of token1 to send |
| data | bytes | Any data to be passed through to the callback |




---




# IAlgebraPoolDerivedState




## Functions
#### getTimepoints view external


`getTimepoints(uint32[])`

Returns the cumulative tick and liquidity as of each timestamp &#x60;secondsAgo&#x60; from the current block timestamp



| Name | Type | Description |
| ---- | ---- | ----------- |
| secondsAgos | uint32[] | From how long ago each cumulative tick and liquidity value should be returned |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulatives | int56[] |  |
| secondsPerLiquidityCumulatives | uint160[] |  |
| volatilityCumulatives | uint112[] |  |
| volumePerAvgLiquiditys | uint256[] |  |

#### getInnerCumulatives view external


`getInnerCumulatives(int24,int24)`

Returns a snapshot of the tick cumulative, seconds per liquidity and seconds inside a tick range



| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 | The lower tick of the range |
| topTick | int24 | The upper tick of the range |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| innerTickCumulative | int56 |  |
| innerSecondsSpentPerLiquidity | uint160 |  |
| innerSecondsSpent | uint32 |  |



---




# IAlgebraPoolEvents


## Events
#### Initialize  


`Initialize(uint160,int24)`

Emitted exactly once by a pool when #initialize is first called on the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| price | uint160 | The initial sqrt price of the pool, as a Q64.96 |
| tick | int24 | The initial tick of the pool, i.e. log base 1.0001 of the starting price of the pool |


#### Mint  


`Mint(address,address,int24,int24,uint128,uint256,uint256)`

Emitted when liquidity is minted for a given position



| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The address that minted the liquidity |
| owner | address | The owner of the position and recipient of any minted liquidity |
| bottomTick | int24 | The lower tick of the position |
| topTick | int24 | The upper tick of the position |
| amount | uint128 | The amount of liquidity minted to the position range |
| amount0 | uint256 | How much token0 was required for the minted liquidity |
| amount1 | uint256 | How much token1 was required for the minted liquidity |


#### Collect  


`Collect(address,address,int24,int24,uint128,uint128)`

Emitted when fees are collected by the owner of a position



| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The owner of the position for which fees are collected |
| recipient | address |  |
| bottomTick | int24 | The lower tick of the position |
| topTick | int24 | The upper tick of the position |
| amount0 | uint128 | The amount of token0 fees collected |
| amount1 | uint128 | The amount of token1 fees collected |


#### Burn  


`Burn(address,int24,int24,uint128,uint256,uint256)`

Emitted when a position&#x27;s liquidity is removed



| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The owner of the position for which liquidity is removed |
| bottomTick | int24 | The lower tick of the position |
| topTick | int24 | The upper tick of the position |
| amount | uint128 | The amount of liquidity to remove |
| amount0 | uint256 | The amount of token0 withdrawn |
| amount1 | uint256 | The amount of token1 withdrawn |


#### Swap  


`Swap(address,address,int256,int256,uint160,uint128,int24)`

Emitted by the pool for any swaps between token0 and token1



| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The address that initiated the swap call, and that received the callback |
| recipient | address | The address that received the output of the swap |
| amount0 | int256 | The delta of the token0 balance of the pool |
| amount1 | int256 | The delta of the token1 balance of the pool |
| price | uint160 | The sqrt(price) of the pool after the swap, as a Q64.96 |
| liquidity | uint128 | The liquidity of the pool after the swap |
| tick | int24 | The log base 1.0001 of price of the pool after the swap |


#### Flash  


`Flash(address,address,uint256,uint256,uint256,uint256)`

Emitted by the pool for any flashes of token0/token1



| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The address that initiated the swap call, and that received the callback |
| recipient | address | The address that received the tokens from flash |
| amount0 | uint256 | The amount of token0 that was flashed |
| amount1 | uint256 | The amount of token1 that was flashed |
| paid0 | uint256 | The amount of token0 paid for the flash, which can exceed the amount0 plus the fee |
| paid1 | uint256 | The amount of token1 paid for the flash, which can exceed the amount1 plus the fee |


#### SetCommunityFee  


`SetCommunityFee(uint8,uint8,uint8,uint8)`

Emitted when the community fee is changed by the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| communityFee0Old | uint8 | The previous value of the token0 community fee percent |
| communityFee1Old | uint8 | The previous value of the token1 community fee percent |
| communityFee0New | uint8 | The updated value of the token0 community fee percent |
| communityFee1New | uint8 | The updated value of the token1 community fee percent |


#### CollectCommunityFee  


`CollectCommunityFee(address,address,uint128,uint128)`

Emitted when the collected community fees are withdrawn by the factory owner



| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The address that collects the community fees |
| recipient | address | The address that receives the collected community fees |
| amount0 | uint128 | The amount of token0 community fees that is withdrawn |
| amount1 | uint128 |  |


#### IncentiveSet  


`IncentiveSet(address)`

Emitted when new activeIncentive is set



| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPoolAddress | address | The address of a virtual pool associated with the current active incentive |


#### ChangeFee  


`ChangeFee(uint16)`

Emitted when the fee changes



| Name | Type | Description |
| ---- | ---- | ----------- |
| Fee | uint16 | The value of the token fee |






---




# IAlgebraPoolImmutables




## Functions
#### dataStorageOperator view external


`dataStorageOperator()`

The contract that stores all the timepoints and can perform actions with them




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

#### factory view external


`factory()`

The contract that deployed the pool, which must adhere to the IAlgebraFactory interface




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

#### token0 view external


`token0()`

The first of the two tokens of the pool, sorted by address




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

#### token1 view external


`token1()`

The second of the two tokens of the pool, sorted by address




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

#### tickSpacing view external


`tickSpacing()`

The pool tick spacing




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint8 |  |

#### maxLiquidityPerTick view external


`maxLiquidityPerTick()`

The maximum amount of position liquidity that can use any tick in the range




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 |  |



---




# IAlgebraPoolPermissionedActions




## Functions
#### setCommunityFee  external


`setCommunityFee(uint8,uint8)`

Set the community&#x27;s % share of the fees



| Name | Type | Description |
| ---- | ---- | ----------- |
| communityFee0 | uint8 | new community fee percent for token0 of the pool |
| communityFee1 | uint8 | new community fee percent for token1 of the pool |


#### setIncentive  external


`setIncentive(address)`

Sets an active incentive



| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPoolAddress | address | The address of a virtual pool associated with the incentive |


#### setLiquidityCooldown  external


`setLiquidityCooldown(uint32)`

Sets new lock time for added liquidity



| Name | Type | Description |
| ---- | ---- | ----------- |
| newLiquidityCooldown | uint32 | The time in seconds |




---




# IAlgebraPoolState




## Functions
#### globalState view external


`globalState()`

The globalState structure in the pool stores many values but requires only one slot
and is exposed as a single method to save gas when accessed externally.




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| price | uint160 |  |
| tick | int24 |  |
| fee | uint16 |  |
| timepointIndex | uint16 |  |
| timepointIndexSwap | uint16 |  |
| communityFeeToken0 | uint8 |  |
| communityFeeToken1 | uint8 |  |
| unlocked | bool |  |

#### totalFeeGrowth0Token view external


`totalFeeGrowth0Token()`

The fee growth as a Q128.128 fees of token0 collected per unit of liquidity for the entire life of the pool




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

#### totalFeeGrowth1Token view external


`totalFeeGrowth1Token()`

The fee growth as a Q128.128 fees of token1 collected per unit of liquidity for the entire life of the pool




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

#### liquidity view external


`liquidity()`

The currently in range liquidity available to the pool




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 |  |

#### ticks view external


`ticks(int24)`

Look up information about a specific tick in the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| tick | int24 | The tick to look up |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidityTotal | uint128 |  |
| liquidityDelta | int128 |  |
| outerFeeGrowth0Token | uint256 |  |
| outerFeeGrowth1Token | uint256 |  |
| outerTickCumulative | int56 |  |
| outerSecondsPerLiquidity | uint160 |  |
| outerSecondsSpent | uint32 |  |
| initialized | bool |  |

#### tickTable view external


`tickTable(int16)`

Returns 256 packed tick initialized boolean values. See TickTable for more information



| Name | Type | Description |
| ---- | ---- | ----------- |
| wordPosition | int16 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

#### positions view external


`positions(bytes32)`

Returns the information about a position by the position&#x27;s key



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | bytes32 | The position&#x27;s key is a hash of a preimage composed by the owner, bottomTick and topTick |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| _liquidity | uint128 |  |
| lastModificationTimestamp | uint32 |  |
| innerFeeGrowth0Token | uint256 |  |
| innerFeeGrowth1Token | uint256 |  |
| fees0 | uint128 |  |
| fees1 | uint128 |  |

#### timepoints view external


`timepoints(uint256)`

Returns data about a specific timepoint index



| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint256 | The element of the timepoints array to fetch |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| initialized | bool |  |
| blockTimestamp | uint32 |  |
| tickCumulative | int56 |  |
| secondsPerLiquidityCumulative | uint160 |  |
| volatilityCumulative | uint88 |  |
| averageTick | int24 |  |
| volumePerLiquidityCumulative | uint144 |  |

#### activeIncentive view external


`activeIncentive()`

Returns the information about active incentive




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPool | address |  |

#### liquidityCooldown view external


`liquidityCooldown()`

Returns the lock time for added liquidity




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| cooldownInSeconds | uint32 |  |



---






# AlgebraFarming

## Modifiers
#### isAuthorizedForToken  









#### onlyIncentiveMaker  









#### onlyOwner  











## Variables
#### contract INonfungiblePositionManager nonfungiblePositionManager immutable

The nonfungible position manager with which this farming contract is compatible

#### contract IAlgebraPoolDeployer deployer immutable

The pool deployer with which this farming contract is compatible

#### contract IVirtualPoolDeployer vdeployer immutable

The virtual pool deployer with which this farming contract is compatible

#### uint256 maxIncentiveStartLeadTime immutable

The max amount of seconds into the future the incentive startTime can be set

#### uint256 maxIncentiveDuration immutable

The max duration of an incentive in seconds

#### mapping(bytes32 &#x3D;&gt; struct AlgebraFarming.Incentive) incentives 



*Developer note: bytes32 refers to the return value of IncentiveId.compute*
#### mapping(uint256 &#x3D;&gt; struct AlgebraFarming.Deposit) deposits 



*Developer note: deposits[tokenId] &#x3D;&gt; Deposit*
#### mapping(uint256 &#x3D;&gt; mapping(bytes32 &#x3D;&gt; uint128)) farms 



*Developer note: farms[tokenId][incentiveHash] &#x3D;&gt; Farm*
#### mapping(contract IERC20Minimal &#x3D;&gt; mapping(address &#x3D;&gt; uint256)) rewards 

Returns amounts of reward tokens owed to a given address according to the last time all farms were updated

*Developer note: rewards[rewardToken][owner] &#x3D;&gt; uint256*

## Functions
#### setIncentiveMaker  external

onlyOwner

`setIncentiveMaker(address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _incentiveMaker | address |  |


#### constructor  public

ERC721Permit

`constructor(contract IAlgebraPoolDeployer,contract INonfungiblePositionManager,contract IVirtualPoolDeployer,uint256,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _deployer | contract IAlgebraPoolDeployer | pool deployer contract address |
| _nonfungiblePositionManager | contract INonfungiblePositionManager | the NFT position manager contract address |
| _vdeployer | contract IVirtualPoolDeployer | virtual pool deployer contract address |
| _maxIncentiveStartLeadTime | uint256 | the max duration of an incentive in seconds |
| _maxIncentiveDuration | uint256 | the max amount of seconds into the future the incentive startTime can be set |


#### createIncentive  external

onlyIncentiveMaker

`createIncentive(struct IAlgebraFarming.IncentiveKey,uint256,uint256)`

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

#### onERC721Received  external


`onERC721Received(address,address,uint256,bytes)`

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

#### withdrawToken  external


`withdrawToken(uint256,address,bytes)`

Withdraws a Algebra LP token &#x60;tokenId&#x60; from this contract to the recipient &#x60;to&#x60;



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The unique identifier of an Algebra LP token |
| to | address | The address where the LP token will be sent |
| data | bytes | An optional data array that will be passed along to the &#x60;to&#x60; address via the NFT safeTransferFrom |


#### enterFarming  external


`enterFarming(struct IAlgebraFarming.IncentiveKey,uint256)`

Farms a Algebra LP token



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IAlgebraFarming.IncentiveKey | The key of the incentive for which to farm the NFT |
| tokenId | uint256 | The ID of the token to farm |


#### exitFarming  external

isAuthorizedForToken

`exitFarming(struct IAlgebraFarming.IncentiveKey,uint256)`

exitFarmings a Algebra LP token



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IAlgebraFarming.IncentiveKey | The key of the incentive for which to exitFarming the NFT |
| tokenId | uint256 | The ID of the token to exitFarming |


#### claimReward  external


`claimReward(contract IERC20Minimal,address,uint256)`

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

#### getRewardInfo view external


`getRewardInfo(struct IAlgebraFarming.IncentiveKey,uint256)`

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

#### getApproved view public


`getApproved(uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |



---




# AlgebraTokenStaking

## Modifiers
#### onlyOwner  










## Events
#### Entered  


`Entered(address,uint256,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| staker | address |  |
| ALGBAmount | uint256 |  |
| xALGBAmount | uint256 |  |


#### Left  


`Left(address,uint256,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| staker | address |  |
| xALGBAmount | uint256 |  |
| ALGBAmount | uint256 |  |



## Variables
#### uint256 freezeTime 



#### address owner 



#### contract IERC20Minimal ALGB 




## Functions
#### constructor  public

ERC20

`constructor(contract IERC20Minimal)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _ALGB | contract IERC20Minimal |  |


#### enter  external


`enter(uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 |  |


#### leave  external


`leave(uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _share | uint256 |  |


#### currentBalance view external


`currentBalance(uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

#### setFreezeTime  external

onlyOwner

`setFreezeTime(uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _freezeTime | uint256 |  |


#### transferOwner  external

onlyOwner

`transferOwner(address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _newOwner | address |  |




---




# AlgebraVault

## Modifiers
#### onlyOwner  









#### onlyRelayerOrOwner  










## Events
#### Swap  


`Swap(contract IERC20,bytes,uint256,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| swappedToken | contract IERC20 |  |
| path | bytes |  |
| amountIn | uint256 |  |
| amountOut | uint256 |  |



## Variables
#### address stakingAddress 



#### address ALGB 



#### address owner 



#### address relayer 




## Functions
#### constructor  public


`constructor(address,address,contract ISwapRouter)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _ALGB | address |  |
| _stakingAddress | address |  |
| _AlgebraRouter | contract ISwapRouter |  |


#### swapToALGB  external

onlyRelayerOrOwner

`swapToALGB(contract IERC20,bytes,uint256,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenToSwap | contract IERC20 |  |
| path | bytes |  |
| amountOutMin | uint256 |  |
| withFee | uint256 |  |


#### transferALGB  external

onlyRelayerOrOwner

`transferALGB()`







#### setRelayer  external

onlyOwner

`setRelayer(address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _relayer | address |  |


#### transferOwner  external

onlyOwner

`transferOwner(address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _newOwner | address |  |




---




# AlgebraVirtualPool

## Modifiers
#### onlyPool  









#### onlyFarming  











## Variables
#### address poolAddress immutable



#### address farmingAddress immutable



#### uint32 desiredEndTimestamp immutable



#### uint32 desiredStartTimestamp immutable



#### uint32 initTimestamp 



#### uint32 endTimestamp 



#### uint32 timeOutside 



#### uint160 globalSecondsPerLiquidityCumulative 



#### uint128 prevLiquidity 



#### uint128 currentLiquidity 



#### uint32 prevTimestamp 



#### int24 globalTick 



#### mapping(int24 &#x3D;&gt; struct TickManager.Tick) ticks 




## Functions
#### constructor  public


`constructor(address,address,uint32,uint32)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _poolAddress | address |  |
| _farmingAddress | address |  |
| _desiredStartTimestamp | uint32 |  |
| _desiredEndTimestamp | uint32 |  |


#### finish  external

onlyFarming

`finish(uint32,uint32)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _endTimestamp | uint32 | The timestamp of the exitFarming |
| startTime | uint32 | The timestamp of planned start of the incentive. Used as initTimestamp if there were no swaps through the entire incentive |


#### getInnerSecondsPerLiquidity view external


`getInnerSecondsPerLiquidity(int24,int24)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 | The bottom tick of a position |
| topTick | int24 | The top tick of a position |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| innerSecondsSpentPerLiquidity | uint160 |  |
| initTime | uint32 |  |
| endTime | uint32 |  |

#### cross  external

onlyPool

`cross(int24,bool)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| nextTick | int24 | The crossed tick |
| zeroForOne | bool | The direction |


#### increaseCumulative  external

onlyPool

`increaseCumulative(uint32)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| currentTimestamp | uint32 | The timestamp of the current swap |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | enum IAlgebraVirtualPool.Status |  |

#### processSwap  external

onlyPool

`processSwap()`







#### applyLiquidityDeltaToPosition  external

onlyFarming

`applyLiquidityDeltaToPosition(int24,int24,int128,int24)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 | The bottom tick of a position |
| topTick | int24 | The top tick of a position |
| liquidityDelta | int128 | The amount of liquidity in a position |
| tick | int24 | The current tick in the main pool |




---




# VirtualPoolDeployer

## Modifiers
#### onlyFarming  









#### onlyOwner  












## Functions
#### constructor  public


`constructor()`







#### setFarming  external

onlyOwner

`setFarming(address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _farming | address |  |


#### deploy  external

onlyFarming

`deploy(address,address,uint32,uint32)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| poolAddress | address |  |
| _farming | address |  |
| _desiredStartTimestamp | uint32 |  |
| _desiredEndTimestamp | uint32 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPool | address |  |



---






# ERC20




## Functions
#### constructor  public


`constructor(string,string)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| name_ | string |  |
| symbol_ | string |  |


#### name view public


`name()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string |  |

#### symbol view public


`symbol()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string |  |

#### decimals view public


`decimals()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint8 |  |

#### totalSupply view public


`totalSupply()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

#### balanceOf view public


`balanceOf(address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

#### transfer  public


`transfer(address,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address |  |
| amount | uint256 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

#### allowance view public


`allowance(address,address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| spender | address |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

#### approve  public


`approve(address,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address |  |
| amount | uint256 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

#### transferFrom  public


`transferFrom(address,address,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address |  |
| recipient | address |  |
| amount | uint256 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

#### increaseAllowance  public


`increaseAllowance(address,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address |  |
| addedValue | uint256 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

#### decreaseAllowance  public


`decreaseAllowance(address,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address |  |
| subtractedValue | uint256 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |



---




# ERC721Permit



## Variables
#### bytes32 PERMIT_TYPEHASH constant

The permit typehash used in the permit signature

*Developer note: Value is equal to keccak256(&quot;Permit(address spender,uint256 tokenId,uint256 nonce,uint256 deadline)&quot;);*

## Functions
#### DOMAIN_SEPARATOR view public


`DOMAIN_SEPARATOR()`

The domain separator used in the permit signature




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32 |  |

#### permit payable external


`permit(address,uint256,uint256,uint8,bytes32,bytes32)`

Approve of a specific token ID for spending by spender via signature



| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address | The account that is being approved |
| tokenId | uint256 | The ID of the token that is being approved for spending |
| deadline | uint256 | The deadline timestamp by which the call must be mined for the approve to work |
| v | uint8 | Must produce valid secp256k1 signature from the holder along with &#x60;r&#x60; and &#x60;s&#x60; |
| r | bytes32 | Must produce valid secp256k1 signature from the holder along with &#x60;v&#x60; and &#x60;s&#x60; |
| s | bytes32 | Must produce valid secp256k1 signature from the holder along with &#x60;r&#x60; and &#x60;v&#x60; |




---




# FreezableToken


## Events
#### Freezed  


`Freezed(address,uint64,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address |  |
| release | uint64 |  |
| amount | uint256 |  |


#### Released  


`Released(address,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| amount | uint256 |  |




## Functions
#### balanceOf view public


`balanceOf(address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | The address to query the the balance of. |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| balance | uint256 |  |

#### actualBalanceOf view public


`actualBalanceOf(address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | The address to query the the balance of. |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| balance | uint256 |  |

#### freezingBalanceOf view public


`freezingBalanceOf(address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| balance | uint256 |  |



---




# IAlgebraFarming


## Events
#### IncentiveCreated  


`IncentiveCreated(contract IERC20Minimal,contract IERC20Minimal,contract IAlgebraPool,address,uint256,uint256,address,uint256,uint256)`

Event emitted when a liquidity mining incentive has been created



| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardToken | contract IERC20Minimal | The token being distributed as a reward |
| bonusRewardToken | contract IERC20Minimal | The token being distributed as a bonus reward |
| pool | contract IAlgebraPool | The Algebra pool |
| virtualPool | address | The virtual pool address |
| startTime | uint256 | The time when the incentive program begins |
| endTime | uint256 | The time when rewards stop accruing |
| refundee | address | The address which receives any remaining reward tokens after the end time |
| reward | uint256 | The amount of reward tokens to be distributed |
| bonusReward | uint256 | The amount of bonus reward tokens to be distributed |


#### DepositTransferred  


`DepositTransferred(uint256,address,address)`

Emitted when ownership of a deposit changes



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the deposit (and token) that is being transferred |
| oldOwner | address | The owner before the deposit was transferred |
| newOwner | address | The owner after the deposit was transferred |


#### FarmStarted  


`FarmStarted(uint256,uint256,bytes32,uint128)`

Event emitted when a Algebra LP token has been farmd



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The unique identifier of an Algebra LP token |
| L2tokenId | uint256 | The unique identifier of an Algebra Farming token |
| incentiveId | bytes32 | The incentive in which the token is farming |
| liquidity | uint128 | The amount of liquidity farmd |


#### FarmEnded  


`FarmEnded(uint256,bytes32,address,address,address,uint256,uint256)`

Event emitted when a Algebra LP token has been exitFarmingd



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The unique identifier of an Algebra LP token |
| incentiveId | bytes32 | The incentive in which the token is farming |
| rewardAddress | address | The token being distributed as a reward |
| bonusRewardToken | address | The token being distributed as a bonus reward |
| owner | address | The address where claimed rewards were sent to |
| reward | uint256 | The amount of reward tokens to be distributed |
| bonusReward | uint256 | The amount of bonus reward tokens to be distributed |


#### IncentiveMakerChanged  


`IncentiveMakerChanged(address,address)`

Emitted when the incentive maker is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| incentiveMaker | address | The incentive maker address before the address was changed |
| _incentiveMaker | address | The factorincentive maker address after the address was changed |


#### RewardClaimed  


`RewardClaimed(address,uint256,address,address)`

Event emitted when a reward token has been claimed



| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address | The address where claimed rewards were sent to |
| reward | uint256 | The amount of reward tokens claimed |
| rewardAddress | address | The token reward address |
| owner | address | The address where claimed rewards were sent to |




## Functions
#### deployer view external


`deployer()`

The pool deployer with which this farming contract is compatible




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IAlgebraPoolDeployer |  |

#### nonfungiblePositionManager view external


`nonfungiblePositionManager()`

The nonfungible position manager with which this farming contract is compatible




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract INonfungiblePositionManager |  |

#### vdeployer view external


`vdeployer()`

The virtual pool deployer with which this farming contract is compatible




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IVirtualPoolDeployer |  |

#### maxIncentiveDuration view external


`maxIncentiveDuration()`

The max duration of an incentive in seconds




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

#### maxIncentiveStartLeadTime view external


`maxIncentiveStartLeadTime()`

The max amount of seconds into the future the incentive startTime can be set




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

#### incentives view external


`incentives(bytes32)`

Represents a farming incentive



| Name | Type | Description |
| ---- | ---- | ----------- |
| incentiveId | bytes32 | The ID of the incentive computed from its parameters |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| totalReward | uint256 |  |
| bonusReward | uint256 |  |
| virtualPoolAddress | address |  |
| numberOfFarms | uint96 |  |
| isPoolCreated | bool |  |
| totalLiquidity | uint224 |  |

#### deposits view external


`deposits(uint256)`

Returns information about a deposited NFT



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| L2TokenId | uint256 |  |
| owner | address |  |
| tickLower | int24 |  |
| tickUpper | int24 |  |

#### farms view external


`farms(uint256,bytes32)`

Returns information about a farmd liquidity NFT



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The ID of the farmd token |
| incentiveId | bytes32 | The ID of the incentive for which the token is farmd |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidity | uint128 |  |

#### setIncentiveMaker  external


`setIncentiveMaker(address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _incentiveMaker | address |  |


#### rewards view external


`rewards(contract IERC20Minimal,address)`

Returns amounts of reward tokens owed to a given address according to the last time all farms were updated



| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardToken | contract IERC20Minimal | The token for which to check rewards |
| owner | address | The owner for which the rewards owed are checked |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardsOwed | uint256 |  |

#### createIncentive  external


`createIncentive(struct IAlgebraFarming.IncentiveKey,uint256,uint256)`

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

#### withdrawToken  external


`withdrawToken(uint256,address,bytes)`

Withdraws a Algebra LP token &#x60;tokenId&#x60; from this contract to the recipient &#x60;to&#x60;



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenId | uint256 | The unique identifier of an Algebra LP token |
| to | address | The address where the LP token will be sent |
| data | bytes | An optional data array that will be passed along to the &#x60;to&#x60; address via the NFT safeTransferFrom |


#### enterFarming  external


`enterFarming(struct IAlgebraFarming.IncentiveKey,uint256)`

Farms a Algebra LP token



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IAlgebraFarming.IncentiveKey | The key of the incentive for which to farm the NFT |
| tokenId | uint256 | The ID of the token to farm |


#### exitFarming  external


`exitFarming(struct IAlgebraFarming.IncentiveKey,uint256)`

exitFarmings a Algebra LP token



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | struct IAlgebraFarming.IncentiveKey | The key of the incentive for which to exitFarming the NFT |
| tokenId | uint256 | The ID of the token to exitFarming |


#### claimReward  external


`claimReward(contract IERC20Minimal,address,uint256)`

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

#### getRewardInfo  external


`getRewardInfo(struct IAlgebraFarming.IncentiveKey,uint256)`

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



---




# IAlgebraIncentiveVirtualPool




## Functions
#### desiredEndTimestamp  external


`desiredEndTimestamp()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

#### desiredStartTimestamp  external


`desiredStartTimestamp()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

#### initTimestamp  external


`initTimestamp()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

#### endTimestamp  external


`endTimestamp()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

#### timeOutside  external


`timeOutside()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

#### globalSecondsPerLiquidityCumulative  external


`globalSecondsPerLiquidityCumulative()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint160 |  |

#### prevLiquidity  external


`prevLiquidity()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 |  |

#### currentLiquidity  external


`currentLiquidity()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 |  |

#### prevTimestamp  external


`prevTimestamp()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

#### globalTick  external


`globalTick()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | int24 |  |

#### ticks  external


`ticks(int24)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| tickId | int24 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidityTotal | uint128 |  |
| liquidityDelta | int128 |  |
| outerFeeGrowth0Token | uint256 |  |
| outerFeeGrowth1Token | uint256 |  |
| outerTickCumulative | int56 |  |
| outerSecondsPerLiquidity | uint160 |  |
| outerSecondsSpent | uint32 |  |
| initialized | bool |  |

#### applyLiquidityDeltaToPosition  external


`applyLiquidityDeltaToPosition(int24,int24,int128,int24)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 | The bottom tick of a position |
| topTick | int24 | The top tick of a position |
| liquidityDelta | int128 | The amount of liquidity in a position |
| tick | int24 | The current tick in the main pool |


#### finish  external


`finish(uint32,uint32)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _endTimestamp | uint32 | The timestamp of the exitFarming |
| startTime | uint32 | The timestamp of planned start of the incentive. Used as initTimestamp if there were no swaps through the entire incentive |


#### getInnerSecondsPerLiquidity view external


`getInnerSecondsPerLiquidity(int24,int24)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 | The bottom tick of a position |
| topTick | int24 | The top tick of a position |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| innerSecondsSpentPerLiquidity | uint160 |  |
| initTime | uint32 |  |
| endTime | uint32 |  |



---




# IERC1271




## Functions
#### isValidSignature view external


`isValidSignature(bytes32,bytes)`

Returns whether the provided signature is valid for the provided data



| Name | Type | Description |
| ---- | ---- | ----------- |
| hash | bytes32 | Hash of the data to be signed |
| signature | bytes | Signature byte array associated with _data |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| magicValue | bytes4 |  |



---




# IERC721Permit




## Functions
#### PERMIT_TYPEHASH pure external


`PERMIT_TYPEHASH()`

The permit typehash used in the permit signature




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32 |  |

#### DOMAIN_SEPARATOR view external


`DOMAIN_SEPARATOR()`

The domain separator used in the permit signature




**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32 |  |

#### permit payable external


`permit(address,uint256,uint256,uint8,bytes32,bytes32)`

Approve of a specific token ID for spending by spender via signature



| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address | The account that is being approved |
| tokenId | uint256 | The ID of the token that is being approved for spending |
| deadline | uint256 | The deadline timestamp by which the call must be mined for the approve to work |
| v | uint8 | Must produce valid secp256k1 signature from the holder along with &#x60;r&#x60; and &#x60;s&#x60; |
| r | bytes32 | Must produce valid secp256k1 signature from the holder along with &#x60;v&#x60; and &#x60;s&#x60; |
| s | bytes32 | Must produce valid secp256k1 signature from the holder along with &#x60;r&#x60; and &#x60;v&#x60; |




---




# IVirtualPoolDeployer


## Events
#### FarmingAddressChanged  


`FarmingAddressChanged(address,address)`

Emitted when the farming address is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| farming | address | The farming address before the address was changed |
| _farming | address | The farming address after the address was changed |




## Functions
#### deploy  external


`deploy(address,address,uint32,uint32)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address |  |
| farming | address |  |
| desiredStartTimestamp | uint32 |  |
| desiredEndTimestamp | uint32 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPool | address |  |

#### setFarming  external


`setFarming(address)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| farming | address | The address of the Algebra framing |




---






















# IAlgebraVirtualPool




## Functions
#### initTimestamp  external


`initTimestamp()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

#### endTimestamp  external


`endTimestamp()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

#### timeOutside  external


`timeOutside()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

#### globalSecondsPerLiquidityCumulative  external


`globalSecondsPerLiquidityCumulative()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint160 |  |

#### currentLiquidity  external


`currentLiquidity()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 |  |

#### globalTick  external


`globalTick()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | int24 |  |

#### prevLiquidity  external


`prevLiquidity()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 |  |

#### _prevTimestamp  external


`_prevTimestamp()`






**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

#### ticks  external


`ticks(int24)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| tickId | int24 |  |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidityTotal | uint128 |  |
| liquidityDelta | int128 |  |
| outerFeeGrowth0Token | uint256 |  |
| outerFeeGrowth1Token | uint256 |  |
| outerTickCumulative | int56 |  |
| outerSecondsPerLiquidity | uint160 |  |
| outerSecondsSpent | uint32 |  |
| initialized | bool |  |

#### applyLiquidityDeltaToPosition  external


`applyLiquidityDeltaToPosition(int24,int24,int128,int24)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 | The bottom tick of a position |
| topTick | int24 | The top tick of a position |
| liquidityDelta | int128 | The amount of liquidity in a position |
| tick | int24 | The current tick in the main pool |


#### cross  external


`cross(int24,bool)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| nextTick | int24 | The crossed tick |
| zeroForOne | bool | The direction |


#### finish  external


`finish(uint32,uint32)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _endTimestamp | uint32 | The timestamp of the exitFarming |
| startTime | uint32 | The timestamp of planned start of the incentive. Used as initTimestamp if there were no swaps through the entire incentive |


#### getInnerSecondsPerLiquidity view external


`getInnerSecondsPerLiquidity(int24,int24)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 | The bottom tick of a position |
| topTick | int24 | The top tick of a position |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| innerSecondsSpentPerLiquidity | uint160 |  |
| initTime | uint32 |  |
| endTime | uint32 |  |

#### processSwap  external


`processSwap()`







#### increaseCumulative  external


`increaseCumulative(uint32,uint32)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| previousTimestamp | uint32 | The timestamp of the previous swap |
| currentTimestamp | uint32 | The timestamp of the current swap |




---




# IERC20Minimal


## Events
#### Transfer  


`Transfer(address,address,uint256)`

Event emitted when tokens are transferred from one address to another, either via &#x60;#transfer&#x60; or &#x60;#transferFrom&#x60;.



| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | The account from which the tokens were sent, i.e. the balance decreased |
| to | address | The account to which the tokens were sent, i.e. the balance increased |
| value | uint256 | The amount of tokens that were transferred |


#### Approval  


`Approval(address,address,uint256)`

Event emitted when the approval amount for the spender of a given owner&#x27;s tokens changes.



| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The account that approved spending of its tokens |
| spender | address | The account for which the spending allowance was modified |
| value | uint256 | The new allowance from the owner to the spender |




## Functions
#### balanceOf view external


`balanceOf(address)`

Returns the balance of a token



| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | The account for which to look up the number of tokens it has, i.e. its balance |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

#### transfer  external


`transfer(address,uint256)`

Transfers the amount of token from the &#x60;msg.sender&#x60; to the recipient



| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | The account that will receive the amount transferred |
| amount | uint256 | The number of tokens to send from the sender to the recipient |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

#### allowance view external


`allowance(address,address)`

Returns the current allowance given to a spender by an owner



| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The account of the token owner |
| spender | address | The account of the token spender |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

#### approve  external


`approve(address,uint256)`

Sets the allowance of a spender from the &#x60;msg.sender&#x60; to the value &#x60;amount&#x60;



| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address | The account which will be allowed to spend a given amount of the owners tokens |
| amount | uint256 | The amount of tokens allowed to be used by &#x60;spender&#x60; |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

#### transferFrom  external


`transferFrom(address,address,uint256)`

Transfers &#x60;amount&#x60; tokens from &#x60;sender&#x60; to &#x60;recipient&#x60; up to the allowance given to the &#x60;msg.sender&#x60;



| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The account from which the transfer will be initiated |
| recipient | address | The recipient of the transfer |
| amount | uint256 | The amount of the transfer |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

#### mintAndFreeze  external


`mintAndFreeze(address,uint256,uint64)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _to | address | Address to which token will be freeze. |
| _amount | uint256 | Amount of token to mint and freeze. |
| _until | uint64 | Release date, must be in future. |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

#### releaseOnce  external


`releaseOnce()`







#### getFreezing view external


`getFreezing(address,uint256)`





| Name | Type | Description |
| ---- | ---- | ----------- |
| _addr | address | Address of freeze tokens owner. |
| _index | uint256 | Freezing portion index. It ordered by release date descending. |

**Returns:**
| Name | Type | Description |
| ---- | ---- | ----------- |
| _release | uint64 |  |
| _balance | uint256 |  |



---


