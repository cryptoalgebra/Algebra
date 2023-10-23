

# IQuoterV2


QuoterV2 Interface

Supports quoting the calculated amounts from exact input or exact output swaps.
For each pool also tells you the number of initialized ticks crossed and the sqrt price of the pool after the swap.

*Developer note: These functions are not marked view because they rely on calling non-view functions and reverting
to compute the result. They are also not gas efficient and should not be called on-chain.
Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-periphery*


## Structs
### QuoteExactInputSingleParams



```solidity
struct QuoteExactInputSingleParams {
  address tokenIn;
  address tokenOut;
  uint256 amountIn;
  uint160 limitSqrtPrice;
}
```

### QuoteExactOutputSingleParams



```solidity
struct QuoteExactOutputSingleParams {
  address tokenIn;
  address tokenOut;
  uint256 amount;
  uint160 limitSqrtPrice;
}
```


## Functions
### quoteExactInput

```solidity
function quoteExactInput(bytes path, uint256 amountInRequired) external returns (uint256 amountOut, uint256 amountIn, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate, uint16[] feeList)
```
**Selector**: `0xcdca1753`

Returns the amount out received for a given exact input swap without executing the swap

| Name | Type | Description |
| ---- | ---- | ----------- |
| path | bytes | The path of the swap, i.e. each token pair |
| amountInRequired | uint256 | The desired amount of the first token to swap |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountOut | uint256 | The amount of the last token that would be received |
| amountIn | uint256 | The amount of the last token that should be paid |
| sqrtPriceX96AfterList | uint160[] | List of the sqrt price after the swap for each pool in the path |
| initializedTicksCrossedList | uint32[] | List of the initialized ticks that the swap crossed for each pool in the path |
| gasEstimate | uint256 | The estimate of the gas that the swap consumes |
| feeList | uint16[] | List of the fee values used for swaps in the path |

### quoteExactInputSingle

```solidity
function quoteExactInputSingle(struct IQuoterV2.QuoteExactInputSingleParams params) external returns (uint256 amountOut, uint256 amountIn, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate, uint16 fee)
```
**Selector**: `0x5e5e6e0f`

Returns the amount out received for a given exact input but for a swap of a single pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct IQuoterV2.QuoteExactInputSingleParams | The params for the quote, encoded as `QuoteExactInputSingleParams` tokenIn The token being swapped in tokenOut The token being swapped out amountIn The desired input amount limitSqrtPrice The price limit of the pool that cannot be exceeded by the swap |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountOut | uint256 | The amount of `tokenOut` that would be received |
| amountIn | uint256 | The amount of the `tokenIn` that should be paid |
| sqrtPriceX96After | uint160 | The sqrt price of the pool after the swap |
| initializedTicksCrossed | uint32 | The number of initialized ticks that the swap crossed |
| gasEstimate | uint256 | The estimate of the gas that the swap consumes |
| fee | uint16 | The fee value used for swap in the pool |

### quoteExactOutput

```solidity
function quoteExactOutput(bytes path, uint256 amountOutRequired) external returns (uint256 amountOut, uint256 amountIn, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate, uint16[] feeList)
```
**Selector**: `0x2f80bb1d`

Returns the amount in required for a given exact output swap without executing the swap

| Name | Type | Description |
| ---- | ---- | ----------- |
| path | bytes | The path of the swap, i.e. each token pair. Path must be provided in reverse order |
| amountOutRequired | uint256 | The amount of the last token to receive |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountOut | uint256 | The amount of the last token that would be received |
| amountIn | uint256 | The amount of first token required to be paid |
| sqrtPriceX96AfterList | uint160[] | List of the sqrt price after the swap for each pool in the path |
| initializedTicksCrossedList | uint32[] | List of the initialized ticks that the swap crossed for each pool in the path |
| gasEstimate | uint256 | The estimate of the gas that the swap consumes |
| feeList | uint16[] | List of the fee values used for swaps in the path |

### quoteExactOutputSingle

```solidity
function quoteExactOutputSingle(struct IQuoterV2.QuoteExactOutputSingleParams params) external returns (uint256 amountOut, uint256 amountIn, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate, uint16 fee)
```
**Selector**: `0x5877c9b9`

Returns the amount in required to receive the given exact output amount but for a swap of a single pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct IQuoterV2.QuoteExactOutputSingleParams | The params for the quote, encoded as `QuoteExactOutputSingleParams` tokenIn The token being swapped in tokenOut The token being swapped out amountOut The desired output amount limitSqrtPrice The price limit of the pool that cannot be exceeded by the swap |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountOut | uint256 | The amount of the last token that would be received |
| amountIn | uint256 | The amount required as the input for the swap in order to receive `amountOut` |
| sqrtPriceX96After | uint160 | The sqrt price of the pool after the swap |
| initializedTicksCrossed | uint32 | The number of initialized ticks that the swap crossed |
| gasEstimate | uint256 | The estimate of the gas that the swap consumes |
| fee | uint16 | The fee value used for swap in the pool |

