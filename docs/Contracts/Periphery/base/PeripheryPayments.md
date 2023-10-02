

# PeripheryPayments






*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-periphery*

**Inherits:** [IPeripheryPayments](../interfaces/IPeripheryPayments.md) [PeripheryImmutableState](PeripheryImmutableState.md)

## Functions
### receive

```solidity
receive() external payable
```



### unwrapWNativeToken

```solidity
function unwrapWNativeToken(uint256 amountMinimum, address recipient) external payable
```
**Selector**: `0x69bc35b2`

Unwraps the contract&#x27;s WNativeToken balance and sends it to recipient as NativeToken.

*Developer note: The amountMinimum parameter prevents malicious contracts from stealing WNativeToken from users.*

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountMinimum | uint256 | The minimum amount of WNativeToken to unwrap |
| recipient | address | The address receiving NativeToken |

### sweepToken

```solidity
function sweepToken(address token, uint256 amountMinimum, address recipient) external payable
```
**Selector**: `0xdf2ab5bb`

Transfers the full amount of a token held by this contract to recipient

*Developer note: The amountMinimum parameter prevents malicious contracts from stealing the token from users*

| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | The contract address of the token which will be transferred to `recipient` |
| amountMinimum | uint256 | The minimum amount of token required for a transfer |
| recipient | address | The destination address of the token |

### refundNativeToken

```solidity
function refundNativeToken() external payable
```
**Selector**: `0x41865270`

Refunds any NativeToken balance held by this contract to the &#x60;msg.sender&#x60;

*Developer note: Useful for bundling with mint or increase liquidity that uses ether, or exact output swaps
that use ether for the input amount*

