

# IAlgebraFlashCallback




@title Callback for IAlgebraPoolActions#flash
 @notice Any contract that calls IAlgebraPoolActions#flash must implement this interface
 @dev Credit to Uniswap Labs under GPL-2.0-or-later license:
 https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces


*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces*




## Functions
### algebraFlashCallback


`function algebraFlashCallback(uint256 fee0, uint256 fee1, bytes data) external`  external

@notice Called to &#x60;msg.sender&#x60; after transferring to the recipient from IAlgebraPool#flash.
 @dev In the implementation you must repay the pool the tokens sent by flash plus the computed fee amounts.
 The caller of this method must be checked to be a AlgebraPool deployed by the canonical AlgebraFactory.
 @param fee0 The fee amount in token0 due to the pool by the end of the flash
 @param fee1 The fee amount in token1 due to the pool by the end of the flash
 @param data Any data passed through by the caller via the IAlgebraPoolActions#flash call



| Name | Type | Description |
| ---- | ---- | ----------- |
| fee0 | uint256 |  |
| fee1 | uint256 |  |
| data | bytes |  |




