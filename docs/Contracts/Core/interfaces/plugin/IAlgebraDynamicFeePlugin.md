

# IAlgebraDynamicFeePlugin


The interface for the Algebra plugin with dynamic fee logic



*Developer note: A plugin with a dynamic fee must implement this interface so that the swap fee can be known through the pool
The fee should be calculated the same way as in the &#x60;beforeSwap&#x60; hook, so the same parameters are passed*


## Functions
### getSwapFee

```solidity
function getSwapFee(address sender, address recipient, bool zeroToOne, int256 amountRequired, uint160 limitSqrtPrice, bool withPaymentInAdvance, bytes data) external view returns (uint24 fee)
```
**Selector**: `0xd67f0f1d`

Returns the fee for a swap with the given parameters, as the &#x60;beforeSwap&#x60; hook would return it

*Developer note: It may differ from the fee of the actual swap if the plugin changes its state in the &#x60;beforeSwap&#x60; hook*

| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The address that would call the swap |
| recipient | address | The address to receive the output of the swap |
| zeroToOne | bool | The direction of the swap, true for token0 to token1, false for token1 to token0 |
| amountRequired | int256 | The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative) |
| limitSqrtPrice | uint160 | The Q64.96 sqrt price limit |
| withPaymentInAdvance | bool | The flag indicating whether the `swapWithPaymentInAdvance` method would be called |
| data | bytes | Data that would be passed through the callback |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| fee | uint24 | The swap fee in hundredths of a bip, i.e. 1e-6 |

