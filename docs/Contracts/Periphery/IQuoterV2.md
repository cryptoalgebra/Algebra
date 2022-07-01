

# IQuoterV2

QuoterV2 Interface
Supports quoting the calculated amounts from exact input or exact output swaps.
For each pool also tells you the number of initialized ticks crossed and the sqrt price of the pool after the swap.
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
| sqrtPriceX96AfterList | uint160[] |  |
| initializedTicksCrossedList | uint32[] |  |
| gasEstimate | uint256 |  |

### quoteExactInputSingle


`quoteExactInputSingle(struct IQuoterV2.QuoteExactInputSingleParams)`  external

Returns the amount out received for a given exact input but for a swap of a single pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct IQuoterV2.QuoteExactInputSingleParams | The params for the quote, encoded as &#x60;QuoteExactInputSingleParams&#x60; tokenIn The token being swapped in tokenOut The token being swapped out amountIn The desired input amount limitSqrtPrice The price limit of the pool that cannot be exceeded by the swap |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountOut | uint256 |  |
| sqrtPriceX96After | uint160 |  |
| initializedTicksCrossed | uint32 |  |
| gasEstimate | uint256 |  |

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
| sqrtPriceX96AfterList | uint160[] |  |
| initializedTicksCrossedList | uint32[] |  |
| gasEstimate | uint256 |  |

### quoteExactOutputSingle


`quoteExactOutputSingle(struct IQuoterV2.QuoteExactOutputSingleParams)`  external

Returns the amount in required to receive the given exact output amount but for a swap of a single pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct IQuoterV2.QuoteExactOutputSingleParams | The params for the quote, encoded as &#x60;QuoteExactOutputSingleParams&#x60; tokenIn The token being swapped in tokenOut The token being swapped out amountOut The desired output amount limitSqrtPrice The price limit of the pool that cannot be exceeded by the swap |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountIn | uint256 |  |
| sqrtPriceX96After | uint160 |  |
| initializedTicksCrossed | uint32 |  |
| gasEstimate | uint256 |  |



---


