

# ISwapRouter


Router token swapping functionality

Functions for swapping tokens via Algebra

*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-periphery*




## Functions
### exactInputSingle


`function exactInputSingle(struct ISwapRouter.ExactInputSingleParams params) external payable returns (uint256 amountOut)` payable external

Swaps &#x60;amountIn&#x60; of one token for as much as possible of another token



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct ISwapRouter.ExactInputSingleParams | The parameters necessary for the swap, encoded as &#x60;ExactInputSingleParams&#x60; in calldata |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountOut | uint256 | The amount of the received token |

### exactInput


`function exactInput(struct ISwapRouter.ExactInputParams params) external payable returns (uint256 amountOut)` payable external

Swaps &#x60;amountIn&#x60; of one token for as much as possible of another along the specified path



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct ISwapRouter.ExactInputParams | The parameters necessary for the multi-hop swap, encoded as &#x60;ExactInputParams&#x60; in calldata |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountOut | uint256 | The amount of the received token |

### exactOutputSingle


`function exactOutputSingle(struct ISwapRouter.ExactOutputSingleParams params) external payable returns (uint256 amountIn)` payable external

Swaps as little as possible of one token for &#x60;amountOut&#x60; of another token



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct ISwapRouter.ExactOutputSingleParams | The parameters necessary for the swap, encoded as &#x60;ExactOutputSingleParams&#x60; in calldata |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountIn | uint256 | The amount of the input token |

### exactOutput


`function exactOutput(struct ISwapRouter.ExactOutputParams params) external payable returns (uint256 amountIn)` payable external

Swaps as little as possible of one token for &#x60;amountOut&#x60; of another along the specified path (reversed)



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct ISwapRouter.ExactOutputParams | The parameters necessary for the multi-hop swap, encoded as &#x60;ExactOutputParams&#x60; in calldata |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountIn | uint256 | The amount of the input token |

### exactInputSingleSupportingFeeOnTransferTokens


`function exactInputSingleSupportingFeeOnTransferTokens(struct ISwapRouter.ExactInputSingleParams params) external returns (uint256 amountOut)`  external

Swaps &#x60;amountIn&#x60; of one token for as much as possible of another along the specified path
*Developer note: Unlike standard swaps, handles transferring from user before the actual swap.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct ISwapRouter.ExactInputSingleParams | The parameters necessary for the multi-hop swap, encoded as &#x60;ExactInputParams&#x60; in calldata |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountOut | uint256 | The amount of the received token |




