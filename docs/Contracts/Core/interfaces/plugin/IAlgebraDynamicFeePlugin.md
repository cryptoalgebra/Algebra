

# IAlgebraDynamicFeePlugin


The interface for the Algebra plugin with dynamic fee logic



*Developer note: A plugin with a dynamic fee must implement this interface so that the current fee can be known through the pool
If the dynamic fee logic does not allow the fee to be calculated without additional data, the method should revert with the appropriate message*


## Functions
### getCurrentFee

```solidity
function getCurrentFee() external view returns (uint16 fee)
```
**Selector**: `0xf70d9362`

Returns fee from plugin

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| fee | uint16 | The pool fee value in hundredths of a bip, i.e. 1e-6 |

