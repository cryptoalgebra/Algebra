

# QuoterV2

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


`quoteExactInputSingle(struct IQuoterV2.QuoteExactInputSingleParams)`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct IQuoterV2.QuoteExactInputSingleParams |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountOut | uint256 |  |
| sqrtPriceX96After | uint160 |  |
| initializedTicksCrossed | uint32 |  |
| gasEstimate | uint256 |  |

### quoteExactInput


`quoteExactInput(bytes,uint256)`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| path | bytes |  |
| amountIn | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountOut | uint256 |  |
| sqrtPriceX96AfterList | uint160[] |  |
| initializedTicksCrossedList | uint32[] |  |
| gasEstimate | uint256 |  |

### quoteExactOutputSingle


`quoteExactOutputSingle(struct IQuoterV2.QuoteExactOutputSingleParams)`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct IQuoterV2.QuoteExactOutputSingleParams |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountIn | uint256 |  |
| sqrtPriceX96After | uint160 |  |
| initializedTicksCrossed | uint32 |  |
| gasEstimate | uint256 |  |

### quoteExactOutput


`quoteExactOutput(bytes,uint256)`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| path | bytes |  |
| amountOut | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountIn | uint256 |  |
| sqrtPriceX96AfterList | uint160[] |  |
| initializedTicksCrossedList | uint32[] |  |
| gasEstimate | uint256 |  |



---


