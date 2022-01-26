

# IAlgebraFlashCallback




## Functions
### AlgebraFlashCallback


`AlgebraFlashCallback(uint256,uint256,bytes)`  external

Called to &#x60;msg.sender&#x60; after transferring to the recipient from IAlgebraPool#flash.



| Name | Type | Description |
| ---- | ---- | ----------- |
| fee0 | uint256 | The fee amount in token0 due to the pool by the end of the flash |
| fee1 | uint256 | The fee amount in token1 due to the pool by the end of the flash |
| data | bytes | Any data passed through by the caller via the IAlgebraPoolActions#flash call |




---


