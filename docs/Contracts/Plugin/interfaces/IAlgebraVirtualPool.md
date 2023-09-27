

# IAlgebraVirtualPool


The interface for the virtual pool



*Developer note: Used to calculate active liquidity in farmings*


## Functions
### crossTo

```solidity
function crossTo(int24 targetTick, bool zeroToOne) external returns (bool success)
```
**Selector**: `0x34d33590`



*Developer note: This function is called by the main pool if an initialized ticks are crossed by swap.
If any one of crossed ticks is also initialized in a virtual pool it should be crossed too*

| Name | Type | Description |
| ---- | ---- | ----------- |
| targetTick | int24 | The target tick up to which we need to cross all active ticks |
| zeroToOne | bool | Swap direction |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| success | bool |  |

