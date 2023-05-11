

# IAlgebraVirtualPool


The interface for the virtual pool

*Developer note: Used to calculate active liquidity in farmings*




## Functions
### crossTo


`function crossTo(int24 targetTick, bool zeroToOne) external returns (bool success)`  external


*Developer note: This function is called by the main pool if an initialized ticks are crossed by swap.
If any one of crossed ticks is also initialized in a virtual pool it should be crossed too*



| Name | Type | Description |
| ---- | ---- | ----------- |
| targetTick | int24 | The target tick up to which we need to cross all active ticks |
| zeroToOne | bool | The direction |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| success | bool |  |





---

