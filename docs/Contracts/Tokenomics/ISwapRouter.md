

# ISwapRouter

Router token swapping functionality
Functions for swapping tokens via Algebra




## Functions
### exactInputSingle


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


`exactInput(struct ISwapRouter.ExactInputParams)` payable external

Swaps &#x60;amountIn&#x60; of one token for as much as possible of another along the specified path



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct ISwapRouter.ExactInputParams | The parameters necessary for the multi-hop swap, encoded as &#x60;ExactInputParams&#x60; in calldata |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountOut | uint256 |  |

### exactOutputSingle


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


`exactOutput(struct ISwapRouter.ExactOutputParams)` payable external

Swaps as little as possible of one token for &#x60;amountOut&#x60; of another along the specified path (reversed)



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct ISwapRouter.ExactOutputParams | The parameters necessary for the multi-hop swap, encoded as &#x60;ExactOutputParams&#x60; in calldata |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountIn | uint256 |  |

### exactInputSingleSupportingFeeOnTransferTokens


`exactInputSingleSupportingFeeOnTransferTokens(struct ISwapRouter.ExactInputSingleParams)`  external

Swaps &#x60;amountIn&#x60; of one token for as much as possible of another along the specified path



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct ISwapRouter.ExactInputSingleParams | The parameters necessary for the multi-hop swap, encoded as &#x60;ExactInputParams&#x60; in calldata |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountOut | uint256 |  |



---


