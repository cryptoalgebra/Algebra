

# ITickLens

Tick Lens
Provides functions for fetching chunks of tick data for a pool
*Developer note: This avoids the waterfall of fetching the tick bitmap, parsing the bitmap to know which ticks to fetch, and
then sending additional multicalls to fetch the tick data*




## Functions
### getPopulatedTicksInWord


`getPopulatedTicksInWord(address,int16)` view external

Get all the tick data for the populated ticks from a word of the tick bitmap of a pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The address of the pool for which to fetch populated tick data |
| tickTableIndex | int16 | The index of the word in the tick bitmap for which to parse the bitmap and fetch all the populated ticks |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| populatedTicks | struct ITickLens.PopulatedTick[] |  |



---


