

# IQuoter


Quoter Interface

Supports quoting the calculated amounts from exact input or exact output swaps

*Developer note: These functions are not marked view because they rely on calling non-view functions and reverting
to compute the result. They are also not gas efficient and should not be called on-chain.
Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-periphery*


## Functions
### quoteExactInput

```solidity
function quoteExactInput(bytes path, uint256 amountIn) external returns (uint256 amountOut, uint16[] fees)
```
**Selector**: `0xcdca1753`

Returns the amount out received for a given exact input swap without executing the swap

| Name | Type | Description |
| ---- | ---- | ----------- |
| path | bytes | The path of the swap, i.e. each token pair |
| amountIn | uint256 | The amount of the first token to swap |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountOut | uint256 | The amount of the last token that would be received |
| fees | uint16[] |  |

### quoteExactInputSingle

```solidity
function quoteExactInputSingle(address tokenIn, address tokenOut, uint256 amountIn, uint160 limitSqrtPrice) external returns (uint256 amountOut, uint16 fee)
```
**Selector**: `0x2d9ebd1d`

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
| amountOut | uint256 | The amount of `tokenOut` that would be received |
| fee | uint16 |  |

### quoteExactOutput

```solidity
function quoteExactOutput(bytes path, uint256 amountOut) external returns (uint256 amountIn, uint16[] fees)
```
**Selector**: `0x2f80bb1d`

Returns the amount in required for a given exact output swap without executing the swap

| Name | Type | Description |
| ---- | ---- | ----------- |
| path | bytes | The path of the swap, i.e. each token pair. Path must be provided in reverse order |
| amountOut | uint256 | The amount of the last token to receive |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountIn | uint256 | The amount of first token required to be paid |
| fees | uint16[] |  |

### quoteExactOutputSingle

```solidity
function quoteExactOutputSingle(address tokenIn, address tokenOut, uint256 amountOut, uint160 limitSqrtPrice) external returns (uint256 amountIn, uint16 fee)
```
**Selector**: `0x9e73c81d`

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
| amountIn | uint256 | The amount required as the input for the swap in order to receive `amountOut` |
| fee | uint16 |  |

