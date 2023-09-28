

# Quoter


Provides quotes for swaps

Allows getting the expected amount out or amount in for a given swap without executing the swap

*Developer note: These functions are not gas efficient and should _not_ be called on chain. Instead, optimistically execute
the swap and check the amounts in the callback.
Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-periphery*

**Inherits:** [IQuoter](../interfaces/IQuoter.md) [IAlgebraSwapCallback](../../Core/interfaces/callback/IAlgebraSwapCallback.md) [PeripheryImmutableState](../base/PeripheryImmutableState.md)

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
function quoteExactInputSingle(address tokenIn, address tokenOut, uint256 amountIn, uint160 limitSqrtPrice) public returns (uint256 amountOut, uint16 fee)
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

### quoteExactOutputSingle

```solidity
function quoteExactOutputSingle(address tokenIn, address tokenOut, uint256 amountOut, uint160 limitSqrtPrice) public returns (uint256 amountIn, uint16 fee)
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

