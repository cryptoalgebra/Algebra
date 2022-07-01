

# IPeripheryPaymentsWithFee

Periphery Payments
Functions to ease deposits and withdrawals of NativeToken




## Functions
### unwrapWNativeTokenWithFee


`unwrapWNativeTokenWithFee(uint256,address,uint256,address)` payable external

Unwraps the contract&#x27;s WNativeToken balance and sends it to recipient as NativeToken, with a percentage between
0 (exclusive), and 1 (inclusive) going to feeRecipient



| Name | Type | Description |
| ---- | ---- | ----------- |
| amountMinimum | uint256 |  |
| recipient | address |  |
| feeBips | uint256 |  |
| feeRecipient | address |  |


### sweepTokenWithFee


`sweepTokenWithFee(address,uint256,address,uint256,address)` payable external

Transfers the full amount of a token held by this contract to recipient, with a percentage between
0 (exclusive) and 1 (inclusive) going to feeRecipient



| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address |  |
| amountMinimum | uint256 |  |
| recipient | address |  |
| feeBips | uint256 |  |
| feeRecipient | address |  |




---


