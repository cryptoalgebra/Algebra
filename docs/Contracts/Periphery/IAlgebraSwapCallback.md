

# IAlgebraSwapCallback

Callback for IAlgebraPoolActions#swap
Any contract that calls IAlgebraPoolActions#swap must implement this interface




## Functions
### algebraSwapCallback


`algebraSwapCallback(int256,int256,bytes)`  external

Called to &#x60;msg.sender&#x60; after executing a swap via IAlgebraPool#swap.



| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0Delta | int256 | The amount of token0 that was sent (negative) or must be received (positive) by the pool by the end of the swap. If positive, the callback must send that amount of token0 to the pool. |
| amount1Delta | int256 | The amount of token1 that was sent (negative) or must be received (positive) by the pool by the end of the swap. If positive, the callback must send that amount of token1 to the pool. |
| data | bytes | Any data passed through by the caller via the IAlgebraPoolActions#swap call |




---


