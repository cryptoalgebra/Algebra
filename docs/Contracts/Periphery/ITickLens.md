

# ITickLens


Tick Lens

Provides functions for fetching chunks of tick data for a pool

*Developer note: This avoids the waterfall of fetching the tick bitmap, parsing the bitmap to know which ticks to fetch, and
then sending additional multicalls to fetch the tick data
Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-periphery*




## Functions
### getPopulatedTicksInWord


`function getPopulatedTicksInWord(address pool, int16 tickTableIndex) external view returns (struct ITickLens.PopulatedTick[] populatedTicks)` view external

Get all the tick data for the populated ticks from a word of the tick bitmap of a pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The address of the pool for which to fetch populated tick data |
| tickTableIndex | int16 | The index of the word in the tick bitmap for which to parse the bitmap and fetch all the populated ticks |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| populatedTicks | struct ITickLens.PopulatedTick[] | An array of tick data for the given word in the tick bitmap |




