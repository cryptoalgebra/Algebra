

# Quoter

Provides quotes for swaps
Allows getting the expected amount out or amount in for a given swap without executing the swap
*Developer note: These functions are not gas efficient and should _not_ be called on chain. Instead, optimistically execute
the swap and check the amounts in the callback.*




## Functions
### constructor

PeripheryImmutableState

`constructor(address,address,address)`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _factory | address |  |
| _WNativeToken | address |  |
| _poolDeployer | address |  |


### algebraSwapCallback


`algebraSwapCallback(int256,int256,bytes)` view external

Called to &#x60;msg.sender&#x60; after executing a swap via IAlgebraPool#swap.



| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0Delta | int256 | The amount of token0 that was sent (negative) or must be received (positive) by the pool by the end of the swap. If positive, the callback must send that amount of token0 to the pool. |
| amount1Delta | int256 | The amount of token1 that was sent (negative) or must be received (positive) by the pool by the end of the swap. If positive, the callback must send that amount of token1 to the pool. |
| path | bytes |  |


### quoteExactInputSingle


`quoteExactInputSingle(address,address,uint256,uint160)`  public

Returns the amount out received for a given exact input but for a swap of a single pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenIn | address | The token being swapped in |
| tokenOut | address | The token being swapped out |
| amountIn | uint256 | The desired input amount |
| limitSqrtPrice | uint160 | The price limit of the pool that cannot be exceeded by the swap |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountOut | uint256 |  |
| fee | uint16 |  |

### quoteExactInput


`quoteExactInput(bytes,uint256)`  external

Returns the amount out received for a given exact input swap without executing the swap



| Name | Type | Description |
| ---- | ---- | ----------- |
| path | bytes | The path of the swap, i.e. each token pair |
| amountIn | uint256 | The amount of the first token to swap |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountOut | uint256 |  |
| fees | uint16[] |  |

### quoteExactOutputSingle


`quoteExactOutputSingle(address,address,uint256,uint160)`  public

Returns the amount in required to receive the given exact output amount but for a swap of a single pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenIn | address | The token being swapped in |
| tokenOut | address | The token being swapped out |
| amountOut | uint256 | The desired output amount |
| limitSqrtPrice | uint160 | The price limit of the pool that cannot be exceeded by the swap |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountIn | uint256 |  |
| fee | uint16 |  |

### quoteExactOutput


`quoteExactOutput(bytes,uint256)`  external

Returns the amount in required for a given exact output swap without executing the swap



| Name | Type | Description |
| ---- | ---- | ----------- |
| path | bytes | The path of the swap, i.e. each token pair. Path must be provided in reverse order |
| amountOut | uint256 | The amount of the last token to receive |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountIn | uint256 |  |
| fees | uint16[] |  |



---


