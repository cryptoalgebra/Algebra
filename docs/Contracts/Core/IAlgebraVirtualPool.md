

# IAlgebraVirtualPool










## Functions
### cross


`function cross(int24 nextTick, bool zeroToOne) external`  external


*Developer note: This function is called by the main pool when an initialized tick is crossed there.
If the tick is also initialized in a virtual pool it should be crossed too*



| Name | Type | Description |
| ---- | ---- | ----------- |
| nextTick | int24 | The crossed tick |
| zeroToOne | bool | The direction |


### increaseCumulative


`function increaseCumulative(uint32 currentTimestamp) external returns (enum IAlgebraVirtualPool.Status)`  external


*Developer note: This function is called from the main pool before every swap To increase seconds per liquidity
cumulative considering previous timestamp and liquidity. The liquidity is stored in a virtual pool*



| Name | Type | Description |
| ---- | ---- | ----------- |
| currentTimestamp | uint32 | The timestamp of the current swap |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | enum IAlgebraVirtualPool.Status | Status The status of virtual pool |




