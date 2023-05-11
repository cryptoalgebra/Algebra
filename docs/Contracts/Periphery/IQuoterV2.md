

# IQuoterV2


QuoterV2 Interface
Supports quoting the calculated amounts from exact input or exact output swaps.
For each pool also tells you the number of initialized ticks crossed and the sqrt price of the pool after the swap.
*Developer note: These functions are not marked view because they rely on calling non-view functions and reverting
to compute the result. They are also not gas efficient and should not be called on-chain.
Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-periphery*




## Functions
### quoteExactInput


`function quoteExactInput(bytes path, uint256 amountIn) external returns (uint256 amountOut, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)`  external

Returns the amount out received for a given exact input swap without executing the swap



| Name | Type | Description |
| ---- | ---- | ----------- |
| path | bytes | The path of the swap, i.e. each token pair |
| amountIn | uint256 | The amount of the first token to swap |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountOut | uint256 | The amount of the last token that would be received |
| sqrtPriceX96AfterList | uint160[] | List of the sqrt price after the swap for each pool in the path |
| initializedTicksCrossedList | uint32[] | List of the initialized ticks that the swap crossed for each pool in the path |
| gasEstimate | uint256 | The estimate of the gas that the swap consumes |

### quoteExactInputSingle


`function quoteExactInputSingle(struct IQuoterV2.QuoteExactInputSingleParams params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)`  external

Returns the amount out received for a given exact input but for a swap of a single pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct IQuoterV2.QuoteExactInputSingleParams | The params for the quote, encoded as &#x60;QuoteExactInputSingleParams&#x60; tokenIn The token being swapped in tokenOut The token being swapped out amountIn The desired input amount limitSqrtPrice The price limit of the pool that cannot be exceeded by the swap |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountOut | uint256 | The amount of &#x60;tokenOut&#x60; that would be received |
| sqrtPriceX96After | uint160 | The sqrt price of the pool after the swap |
| initializedTicksCrossed | uint32 | The number of initialized ticks that the swap crossed |
| gasEstimate | uint256 | The estimate of the gas that the swap consumes |

### quoteExactOutput


`function quoteExactOutput(bytes path, uint256 amountOut) external returns (uint256 amountIn, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)`  external

Returns the amount in required for a given exact output swap without executing the swap



| Name | Type | Description |
| ---- | ---- | ----------- |
| path | bytes | The path of the swap, i.e. each token pair. Path must be provided in reverse order |
| amountOut | uint256 | The amount of the last token to receive |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountIn | uint256 | The amount of first token required to be paid |
| sqrtPriceX96AfterList | uint160[] | List of the sqrt price after the swap for each pool in the path |
| initializedTicksCrossedList | uint32[] | List of the initialized ticks that the swap crossed for each pool in the path |
| gasEstimate | uint256 | The estimate of the gas that the swap consumes |

### quoteExactOutputSingle


`function quoteExactOutputSingle(struct IQuoterV2.QuoteExactOutputSingleParams params) external returns (uint256 amountIn, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)`  external

Returns the amount in required to receive the given exact output amount but for a swap of a single pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct IQuoterV2.QuoteExactOutputSingleParams | The params for the quote, encoded as &#x60;QuoteExactOutputSingleParams&#x60; tokenIn The token being swapped in tokenOut The token being swapped out amountOut The desired output amount limitSqrtPrice The price limit of the pool that cannot be exceeded by the swap |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountIn | uint256 | The amount required as the input for the swap in order to receive &#x60;amountOut&#x60; |
| sqrtPriceX96After | uint160 | The sqrt price of the pool after the swap |
| initializedTicksCrossed | uint32 | The number of initialized ticks that the swap crossed |
| gasEstimate | uint256 | The estimate of the gas that the swap consumes |





---

