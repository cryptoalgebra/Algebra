

# IAlgebraSwapCallback


Callback for IAlgebraPoolActions#swap

Any contract that calls IAlgebraPoolActions#swap must implement this interface

*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces*


## Functions
### algebraSwapCallback


`function algebraSwapCallback(int256 amount0Delta, int256 amount1Delta, bytes data) external`  external

Called to &#x60;msg.sender&#x60; after executing a swap via IAlgebraPool#swap.

*Developer note: In the implementation you must pay the pool tokens owed for the swap.
The caller of this method _must_ be checked to be a AlgebraPool deployed by the canonical AlgebraFactory.
amount0Delta and amount1Delta can both be 0 if no tokens were swapped.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0Delta | int256 | The amount of token0 that was sent (negative) or must be received (positive) by the pool by
| amount1Delta | int256 | The amount of token1 that was sent (negative) or must be received (positive) by the pool by
| data | bytes | Any data passed through by the caller via the IAlgebraPoolActions#swap call |

