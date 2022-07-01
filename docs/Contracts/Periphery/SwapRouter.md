

# SwapRouter

Algebra Swap Router
Router for stateless execution of swaps against Algebra




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


`algebraSwapCallback(int256,int256,bytes)`  external

Called to &#x60;msg.sender&#x60; after executing a swap via IAlgebraPool#swap.



| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0Delta | int256 | The amount of token0 that was sent (negative) or must be received (positive) by the pool by the end of the swap. If positive, the callback must send that amount of token0 to the pool. |
| amount1Delta | int256 | The amount of token1 that was sent (negative) or must be received (positive) by the pool by the end of the swap. If positive, the callback must send that amount of token1 to the pool. |
| _data | bytes |  |


### exactInputSingle

checkDeadline

`exactInputSingle(struct ISwapRouter.ExactInputSingleParams)` payable external

Swaps &#x60;amountIn&#x60; of one token for as much as possible of another token



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct ISwapRouter.ExactInputSingleParams | The parameters necessary for the swap, encoded as &#x60;ExactInputSingleParams&#x60; in calldata |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountOut | uint256 |  |

### exactInput

checkDeadline

`exactInput(struct ISwapRouter.ExactInputParams)` payable external

Swaps &#x60;amountIn&#x60; of one token for as much as possible of another along the specified path



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct ISwapRouter.ExactInputParams | The parameters necessary for the multi-hop swap, encoded as &#x60;ExactInputParams&#x60; in calldata |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountOut | uint256 |  |

### exactInputSingleSupportingFeeOnTransferTokens

checkDeadline

`exactInputSingleSupportingFeeOnTransferTokens(struct ISwapRouter.ExactInputSingleParams)`  external

Swaps &#x60;amountIn&#x60; of one token for as much as possible of another along the specified path



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct ISwapRouter.ExactInputSingleParams | The parameters necessary for the multi-hop swap, encoded as &#x60;ExactInputParams&#x60; in calldata |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountOut | uint256 |  |

### exactOutputSingle

checkDeadline

`exactOutputSingle(struct ISwapRouter.ExactOutputSingleParams)` payable external

Swaps as little as possible of one token for &#x60;amountOut&#x60; of another token



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct ISwapRouter.ExactOutputSingleParams | The parameters necessary for the swap, encoded as &#x60;ExactOutputSingleParams&#x60; in calldata |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountIn | uint256 |  |

### exactOutput

checkDeadline

`exactOutput(struct ISwapRouter.ExactOutputParams)` payable external

Swaps as little as possible of one token for &#x60;amountOut&#x60; of another along the specified path (reversed)



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct ISwapRouter.ExactOutputParams | The parameters necessary for the multi-hop swap, encoded as &#x60;ExactOutputParams&#x60; in calldata |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountIn | uint256 |  |



---


