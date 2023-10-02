

# IAlgebraSwapCallback


Callback for [IAlgebraPoolActions#swap](../pool/IAlgebraPoolActions.md#swap)

Any contract that calls [IAlgebraPoolActions#swap](../pool/IAlgebraPoolActions.md#swap) must implement this interface

*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces*


## Functions
### algebraSwapCallback

```solidity
function algebraSwapCallback(int256 amount0Delta, int256 amount1Delta, bytes data) external
```
**Selector**: `0x2c8958f6`

Called to &#x60;msg.sender&#x60; after executing a swap via [IAlgebraPool#swap](../IAlgebraPool.md#swap).

*Developer note: In the implementation you must pay the pool tokens owed for the swap.
The caller of this method _must_ be checked to be a AlgebraPool deployed by the canonical AlgebraFactory.
amount0Delta and amount1Delta can both be 0 if no tokens were swapped.*

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0Delta | int256 | The amount of token0 that was sent (negative) or must be received (positive) by the pool by the end of the swap. If positive, the callback must send that amount of token0 to the pool. |
| amount1Delta | int256 | The amount of token1 that was sent (negative) or must be received (positive) by the pool by the end of the swap. If positive, the callback must send that amount of token1 to the pool. |
| data | bytes | Any data passed through by the caller via the [IAlgebraPoolActions#swap](../pool/IAlgebraPoolActions.md#swap) call |

