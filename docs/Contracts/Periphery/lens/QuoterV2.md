

# QuoterV2


Provides quotes for swaps

Allows getting the expected amount out or amount in for a given swap without executing the swap

*Developer note: These functions are not gas efficient and should _not_ be called on chain. Instead, optimistically execute
the swap and check the amounts in the callback.
Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-periphery*

**Inherits:** [IQuoterV2](../interfaces/IQuoterV2.md) [IAlgebraSwapCallback](../../Core/interfaces/callback/IAlgebraSwapCallback.md) [PeripheryImmutableState](../base/PeripheryImmutableState.md)

## Functions
### constructor

```solidity
constructor(address _factory, address _WNativeToken, address _poolDeployer) public
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| _factory | address |  |
| _WNativeToken | address |  |
| _poolDeployer | address |  |

### algebraSwapCallback

```solidity
function algebraSwapCallback(int256 amount0Delta, int256 amount1Delta, bytes path) external view
```
**Selector**: `0x2c8958f6`

Called to &#x60;msg.sender&#x60; after executing a swap via [IAlgebraPool#swap](../../Core/interfaces/IAlgebraPool.md#swap).

*Developer note: In the implementation you must pay the pool tokens owed for the swap.
The caller of this method _must_ be checked to be a AlgebraPool deployed by the canonical AlgebraFactory.
amount0Delta and amount1Delta can both be 0 if no tokens were swapped.*

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0Delta | int256 | The amount of token0 that was sent (negative) or must be received (positive) by the pool by the end of the swap. If positive, the callback must send that amount of token0 to the pool. |
| amount1Delta | int256 | The amount of token1 that was sent (negative) or must be received (positive) by the pool by the end of the swap. If positive, the callback must send that amount of token1 to the pool. |
| path | bytes |  |

### quoteExactInputSingle

```solidity
function quoteExactInputSingle(struct IQuoterV2.QuoteExactInputSingleParams params) public returns (uint256 amountOut, uint256 amountIn, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate, uint16 fee)
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

### quoteExactInput

```solidity
function quoteExactInput(bytes path, uint256 amountInRequired) public returns (uint256 amountOut, uint256 amountIn, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate, uint16[] feeList)
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

### quoteExactOutputSingle

```solidity
function quoteExactOutputSingle(struct IQuoterV2.QuoteExactOutputSingleParams params) public returns (uint256 amountOut, uint256 amountIn, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate, uint16 fee)
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

### quoteExactOutput

```solidity
function quoteExactOutput(bytes path, uint256 amountOutRequired) public returns (uint256 amountOut, uint256 amountIn, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate, uint16[] feeList)
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

