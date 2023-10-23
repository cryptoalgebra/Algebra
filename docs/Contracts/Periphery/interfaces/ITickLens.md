

# ITickLens


Tick Lens

Provides functions for fetching chunks of tick data for a pool

*Developer note: This avoids the waterfall of fetching the tick bitmap, parsing the bitmap to know which ticks to fetch, and
then sending additional multicalls to fetch the tick data
Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-periphery*


## Structs
### PopulatedTick



```solidity
struct PopulatedTick {
  int24 tick;
  int128 liquidityNet;
  uint128 liquidityGross;
}
```


## Functions
### getPopulatedTicksInWord

```solidity
function getPopulatedTicksInWord(address pool, int16 tickTableIndex) external view returns (struct ITickLens.PopulatedTick[] populatedTicks)
```
**Selector**: `0x351fb478`

Get all the tick data for the populated ticks from a word of the tick bitmap of a pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The address of the pool for which to fetch populated tick data |
| tickTableIndex | int16 | The index of the word in the tick bitmap for which to parse the bitmap and fetch all the populated ticks |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| populatedTicks | struct ITickLens.PopulatedTick[] | An array of tick data for the given word in the tick bitmap |

### getClosestActiveTicks

```solidity
function getClosestActiveTicks(address pool, int24 targetTick) external view returns (struct ITickLens.PopulatedTick[2] populatedTicks)
```
**Selector**: `0xec92d7fa`

Get closest initialized ticks around &#x60;targetTick&#x60;

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The address of the pool for which to fetch populated tick data |
| targetTick | int24 | The tick around which the nearest ticks will be searched |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| populatedTicks | struct ITickLens.PopulatedTick[2] | An array of two ticks: before or at `targetTick` and after `targetTick` |

### getNextActiveTicks

```solidity
function getNextActiveTicks(address pool, int24 startingTick, uint256 amount, bool upperDirection) external view returns (struct ITickLens.PopulatedTick[] populatedTicks)
```
**Selector**: `0xc5493f77`

Get all the tick data for the &#x60;amount&#x60; (or less) of populated ticks after &#x60;startingTick&#x60; (including &#x60;startingTick&#x60; itself)

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The address of the pool for which to fetch populated tick data |
| startingTick | int24 | The starting tick index. Must be populated tick |
| amount | uint256 | The maximum amount of ticks requested |
| upperDirection | bool | The direction of search. Will fetch 'next' ticks in direction of price increase if true |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| populatedTicks | struct ITickLens.PopulatedTick[] | An array of tick data for fetched ticks (`amount` or less) |

