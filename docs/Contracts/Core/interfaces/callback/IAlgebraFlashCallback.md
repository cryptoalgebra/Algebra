

# IAlgebraFlashCallback


Callback for [IAlgebraPoolActions#flash](../pool/IAlgebraPoolActions.md#flash)

Any contract that calls [IAlgebraPoolActions#flash](../pool/IAlgebraPoolActions.md#flash) must implement this interface

*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces*


## Functions
### algebraFlashCallback

```solidity
function algebraFlashCallback(uint256 fee0, uint256 fee1, bytes data) external
```
**Selector**: `0xa60b0d3c`

Called to &#x60;msg.sender&#x60; after transferring to the recipient from [IAlgebraPool#flash](../IAlgebraPool.md#flash).

*Developer note: In the implementation you must repay the pool the tokens sent by flash plus the computed fee amounts.
The caller of this method _must_ be checked to be a AlgebraPool deployed by the canonical AlgebraFactory.*

| Name | Type | Description |
| ---- | ---- | ----------- |
| fee0 | uint256 | The fee amount in token0 due to the pool by the end of the flash |
| fee1 | uint256 | The fee amount in token1 due to the pool by the end of the flash |
| data | bytes | Any data passed through by the caller via the [IAlgebraPoolActions#flash](../pool/IAlgebraPoolActions.md#flash) call |

