

# ISwapRouter


Router token swapping functionality

Functions for swapping tokens via Algebra

*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-periphery*

**Inherits:** [IAlgebraSwapCallback](../../Core/interfaces/callback/IAlgebraSwapCallback.md)

## Structs
### ExactInputSingleParams



```solidity
struct ExactInputSingleParams {
  address tokenIn;
  address tokenOut;
  address recipient;
  uint256 deadline;
  uint256 amountIn;
  uint256 amountOutMinimum;
  uint160 limitSqrtPrice;
}
```

### ExactInputParams



```solidity
struct ExactInputParams {
  bytes path;
  address recipient;
  uint256 deadline;
  uint256 amountIn;
  uint256 amountOutMinimum;
}
```

### ExactOutputSingleParams



```solidity
struct ExactOutputSingleParams {
  address tokenIn;
  address tokenOut;
  address recipient;
  uint256 deadline;
  uint256 amountOut;
  uint256 amountInMaximum;
  uint160 limitSqrtPrice;
}
```

### ExactOutputParams



```solidity
struct ExactOutputParams {
  bytes path;
  address recipient;
  uint256 deadline;
  uint256 amountOut;
  uint256 amountInMaximum;
}
```


## Functions
### exactInputSingle

```solidity
function exactInputSingle(struct ISwapRouter.ExactInputSingleParams params) external payable returns (uint256 amountOut)
```
**Selector**: `0xbc651188`

Swaps &#x60;amountIn&#x60; of one token for as much as possible of another token

| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct ISwapRouter.ExactInputSingleParams | The parameters necessary for the swap, encoded as `ExactInputSingleParams` in calldata |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountOut | uint256 | The amount of the received token |

### exactInput

```solidity
function exactInput(struct ISwapRouter.ExactInputParams params) external payable returns (uint256 amountOut)
```
**Selector**: `0xc04b8d59`

Swaps &#x60;amountIn&#x60; of one token for as much as possible of another along the specified path

| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct ISwapRouter.ExactInputParams | The parameters necessary for the multi-hop swap, encoded as `ExactInputParams` in calldata |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountOut | uint256 | The amount of the received token |

### exactOutputSingle

```solidity
function exactOutputSingle(struct ISwapRouter.ExactOutputSingleParams params) external payable returns (uint256 amountIn)
```
**Selector**: `0x61d4d5b3`

Swaps as little as possible of one token for &#x60;amountOut&#x60; of another token

| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct ISwapRouter.ExactOutputSingleParams | The parameters necessary for the swap, encoded as `ExactOutputSingleParams` in calldata |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountIn | uint256 | The amount of the input token |

### exactOutput

```solidity
function exactOutput(struct ISwapRouter.ExactOutputParams params) external payable returns (uint256 amountIn)
```
**Selector**: `0xf28c0498`

Swaps as little as possible of one token for &#x60;amountOut&#x60; of another along the specified path (reversed)

| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct ISwapRouter.ExactOutputParams | The parameters necessary for the multi-hop swap, encoded as `ExactOutputParams` in calldata |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountIn | uint256 | The amount of the input token |

### exactInputSingleSupportingFeeOnTransferTokens

```solidity
function exactInputSingleSupportingFeeOnTransferTokens(struct ISwapRouter.ExactInputSingleParams params) external payable returns (uint256 amountOut)
```
**Selector**: `0xb87d2524`

Swaps &#x60;amountIn&#x60; of one token for as much as possible of another along the specified path

*Developer note: Unlike standard swaps, handles transferring from user before the actual swap.*

| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct ISwapRouter.ExactInputSingleParams | The parameters necessary for the swap, encoded as `ExactInputSingleParams` in calldata |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountOut | uint256 | The amount of the received token |

