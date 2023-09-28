

# SwapRouter


Algebra Swap Router

Router for stateless execution of swaps against Algebra

*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-periphery*

**Inherits:** [ISwapRouter](interfaces/ISwapRouter.md) [PeripheryImmutableState](base/PeripheryImmutableState.md) PeripheryValidation [PeripheryPaymentsWithFee](base/PeripheryPaymentsWithFee.md) [Multicall](base/Multicall.md) [SelfPermit](base/SelfPermit.md)

## Structs
### SwapCallbackData



```solidity
struct SwapCallbackData {
  bytes path;
  address payer;
}
```


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
function algebraSwapCallback(int256 amount0Delta, int256 amount1Delta, bytes _data) external
```
**Selector**: `0x2c8958f6`

Called to &#x60;msg.sender&#x60; after executing a swap via [IAlgebraPool#swap](../Core/interfaces/IAlgebraPool.md#swap).

*Developer note: In the implementation you must pay the pool tokens owed for the swap.
The caller of this method _must_ be checked to be a AlgebraPool deployed by the canonical AlgebraFactory.
amount0Delta and amount1Delta can both be 0 if no tokens were swapped.*

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0Delta | int256 | The amount of token0 that was sent (negative) or must be received (positive) by the pool by the end of the swap. If positive, the callback must send that amount of token0 to the pool. |
| amount1Delta | int256 | The amount of token1 that was sent (negative) or must be received (positive) by the pool by the end of the swap. If positive, the callback must send that amount of token1 to the pool. |
| _data | bytes |  |

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

