

# IQuoter

Quoter Interface
Supports quoting the calculated amounts from exact input or exact output swaps
*Developer note: These functions are not marked view because they rely on calling non-view functions and reverting
to compute the result. They are also not gas efficient and should not be called on-chain.*




## Functions
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

### quoteExactInputSingle


`quoteExactInputSingle(address,address,uint256,uint160)`  external

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

### quoteExactOutputSingle


`quoteExactOutputSingle(address,address,uint256,uint160)`  external

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



---


