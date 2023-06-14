

# AlgebraPool


Algebra concentrated liquidity pool

This contract is responsible for liquidity positions, swaps and flashloans

*Developer note: Version: Algebra V1.9*

## Modifiers
### onlyFactoryOwner


`modifier onlyFactoryOwner()`  internal


*Developer note: Restricts everyone calling a function except factory owner*





### onlyValidTicks


`modifier onlyValidTicks(int24 bottomTick, int24 topTick)`  internal





| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 |  |
| topTick | int24 |  |




## Variables
### mapping(bytes32 &#x3D;&gt; struct AlgebraPool.Position) positions 

Returns the information about a position by the position&#x27;s key

*Developer note: This is a public mapping of structures, so the &#x60;return&#x60; natspec tags are omitted.*

## Functions
### constructor


`constructor() public`  public







### timepoints


`function timepoints(uint256 index) external view returns (bool initialized, uint32 blockTimestamp, int56 tickCumulative, uint160 secondsPerLiquidityCumulative, uint88 volatilityCumulative, int24 averageTick, uint144 volumePerLiquidityCumulative)` view external

Returns data about a specific timepoint index
*Developer note: You most likely want to use #getTimepoints() instead of this method to get an timepoint as of some amount of time
ago, rather than at a specific index in the array.
This is a public mapping of structures, so the &#x60;return&#x60; natspec tags are omitted.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint256 | The element of the timepoints array to fetch |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| initialized | bool | whether the timepoint has been initialized and the values are safe to use; Returns blockTimestamp The timestamp of the timepoint; Returns tickCumulative the tick multiplied by seconds elapsed for the life of the pool as of the timepoint timestamp; Returns secondsPerLiquidityCumulative the seconds per in range liquidity for the life of the pool as of the timepoint timestamp; Returns volatilityCumulative Cumulative standard deviation for the life of the pool as of the timepoint timestamp; Returns averageTick Time-weighted average tick; Returns volumePerLiquidityCumulative Cumulative swap volume per liquidity for the life of the pool as of the timepoint timestamp; |
| blockTimestamp | uint32 |  |
| tickCumulative | int56 |  |
| secondsPerLiquidityCumulative | uint160 |  |
| volatilityCumulative | uint88 |  |
| averageTick | int24 |  |
| volumePerLiquidityCumulative | uint144 |  |

### getInnerCumulatives


`function getInnerCumulatives(int24 bottomTick, int24 topTick) external view returns (int56 innerTickCumulative, uint160 innerSecondsSpentPerLiquidity, uint32 innerSecondsSpent)` view external

Returns a snapshot of the tick cumulative, seconds per liquidity and seconds inside a tick range
*Developer note: Snapshots must only be compared to other snapshots, taken over a period for which a position existed.
I.e., snapshots cannot be compared if a position is not held for the entire period between when the first
snapshot is taken and the second snapshot is taken.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 | The lower tick of the range |
| topTick | int24 | The upper tick of the range |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| innerTickCumulative | int56 | The snapshot of the tick accumulator for the range |
| innerSecondsSpentPerLiquidity | uint160 | The snapshot of seconds per liquidity for the range |
| innerSecondsSpent | uint32 | The snapshot of the number of seconds during which the price was in this range |

### getTimepoints


`function getTimepoints(uint32[] secondsAgos) external view returns (int56[] tickCumulatives, uint160[] secondsPerLiquidityCumulatives, uint112[] volatilityCumulatives, uint256[] volumePerAvgLiquiditys)` view external

Returns the cumulative tick and liquidity as of each timestamp &#x60;secondsAgo&#x60; from the current block timestamp
*Developer note: To get a time weighted average tick or liquidity-in-range, you must call this with two values, one representing
the beginning of the period and another for the end of the period. E.g., to get the last hour time-weighted average tick,
you must call it with secondsAgos &#x3D; [3600, 0].
The time weighted average tick represents the geometric time weighted average price of the pool, in
log base sqrt(1.0001) of token1 / token0. The TickMath library can be used to go from a tick value to a ratio.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| secondsAgos | uint32[] | From how long ago each cumulative tick and liquidity value should be returned |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulatives | int56[] | Cumulative tick values as of each &#x60;secondsAgos&#x60; from the current block timestamp |
| secondsPerLiquidityCumulatives | uint160[] | Cumulative seconds per liquidity-in-range value as of each &#x60;secondsAgos&#x60; from the current block timestamp |
| volatilityCumulatives | uint112[] | Cumulative standard deviation as of each &#x60;secondsAgos&#x60; |
| volumePerAvgLiquiditys | uint256[] | Cumulative swap volume per liquidity as of each &#x60;secondsAgos&#x60; |

### initialize


`function initialize(uint160 initialPrice) external`  external

Sets the initial price for the pool
*Developer note: Price is represented as a sqrt(amountToken1/amountToken0) Q64.96 value*



| Name | Type | Description |
| ---- | ---- | ----------- |
| initialPrice | uint160 |  |


### mint


`function mint(address sender, address recipient, int24 bottomTick, int24 topTick, uint128 liquidityDesired, bytes data) external returns (uint256 amount0, uint256 amount1, uint128 liquidityActual)`  external

Adds liquidity for the given recipient/bottomTick/topTick position
*Developer note: The caller of this method receives a callback in the form of IAlgebraMintCallback# AlgebraMintCallback
in which they must pay any token0 or token1 owed for the liquidity. The amount of token0/token1 due depends
on bottomTick, topTick, the amount of liquidity, and the current price.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The address which will receive potential surplus of paid tokens |
| recipient | address | The address for which the liquidity will be created |
| bottomTick | int24 | The lower tick of the position in which to add liquidity |
| topTick | int24 | The upper tick of the position in which to add liquidity |
| liquidityDesired | uint128 |  |
| data | bytes | Any data that should be passed through to the callback |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint256 | The amount of token0 that was paid to mint the given amount of liquidity. Matches the value in the callback |
| amount1 | uint256 | The amount of token1 that was paid to mint the given amount of liquidity. Matches the value in the callback |
| liquidityActual | uint128 | The actual minted amount of liquidity |

### collect


`function collect(address recipient, int24 bottomTick, int24 topTick, uint128 amount0Requested, uint128 amount1Requested) external returns (uint128 amount0, uint128 amount1)`  external

Collects tokens owed to a position
*Developer note: Does not recompute fees earned, which must be done either via mint or burn of any amount of liquidity.
Collect must be called by the position owner. To withdraw only token0 or only token1, amount0Requested or
amount1Requested may be set to zero. To withdraw all tokens owed, caller may pass any value greater than the
actual tokens owed, e.g. type(uint128).max. Tokens owed may be from accumulated swap fees or burned liquidity.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | The address which should receive the fees collected |
| bottomTick | int24 | The lower tick of the position for which to collect fees |
| topTick | int24 | The upper tick of the position for which to collect fees |
| amount0Requested | uint128 | How much token0 should be withdrawn from the fees owed |
| amount1Requested | uint128 | How much token1 should be withdrawn from the fees owed |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint128 | The amount of fees collected in token0 |
| amount1 | uint128 | The amount of fees collected in token1 |

### burn


`function burn(int24 bottomTick, int24 topTick, uint128 amount) external returns (uint256 amount0, uint256 amount1)`  external

Burn liquidity from the sender and account tokens owed for the liquidity to the position
*Developer note: Can be used to trigger a recalculation of fees owed to a position by calling with an amount of 0
Fees must be collected separately via a call to #collect*



| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 | The lower tick of the position for which to burn liquidity |
| topTick | int24 | The upper tick of the position for which to burn liquidity |
| amount | uint128 | How much liquidity to burn |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint256 | The amount of token0 sent to the recipient |
| amount1 | uint256 | The amount of token1 sent to the recipient |

### swap


`function swap(address recipient, bool zeroToOne, int256 amountRequired, uint160 limitSqrtPrice, bytes data) external returns (int256 amount0, int256 amount1)`  external

Swap token0 for token1, or token1 for token0
*Developer note: The caller of this method receives a callback in the form of IAlgebraSwapCallback# AlgebraSwapCallback*



| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | The address to receive the output of the swap |
| zeroToOne | bool | The direction of the swap, true for token0 to token1, false for token1 to token0 |
| amountRequired | int256 |  |
| limitSqrtPrice | uint160 | The Q64.96 sqrt price limit. If zero for one, the price cannot be less than this value after the swap. If one for zero, the price cannot be greater than this value after the swap |
| data | bytes | Any data to be passed through to the callback. If using the Router it should contain SwapRouter#SwapCallbackData |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | int256 | The delta of the balance of token0 of the pool, exact when negative, minimum when positive |
| amount1 | int256 | The delta of the balance of token1 of the pool, exact when negative, minimum when positive |

### swapSupportingFeeOnInputTokens


`function swapSupportingFeeOnInputTokens(address sender, address recipient, bool zeroToOne, int256 amountRequired, uint160 limitSqrtPrice, bytes data) external returns (int256 amount0, int256 amount1)`  external

Swap token0 for token1, or token1 for token0 (tokens that have fee on transfer)
*Developer note: The caller of this method receives a callback in the form of I AlgebraSwapCallback# AlgebraSwapCallback*



| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The address called this function (Comes from the Router) |
| recipient | address | The address to receive the output of the swap |
| zeroToOne | bool | The direction of the swap, true for token0 to token1, false for token1 to token0 |
| amountRequired | int256 |  |
| limitSqrtPrice | uint160 | The Q64.96 sqrt price limit. If zero for one, the price cannot be less than this value after the swap. If one for zero, the price cannot be greater than this value after the swap |
| data | bytes | Any data to be passed through to the callback. If using the Router it should contain SwapRouter#SwapCallbackData |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | int256 | The delta of the balance of token0 of the pool, exact when negative, minimum when positive |
| amount1 | int256 | The delta of the balance of token1 of the pool, exact when negative, minimum when positive |

### flash


`function flash(address recipient, uint256 amount0, uint256 amount1, bytes data) external`  external

Receive token0 and/or token1 and pay it back, plus a fee, in the callback
*Developer note: The caller of this method receives a callback in the form of IAlgebraFlashCallback# AlgebraFlashCallback
All excess tokens paid in the callback are distributed to liquidity providers as an additional fee. So this method can be used
to donate underlying tokens to currently in-range liquidity providers by calling with 0 amount{0,1} and sending
the donation amount(s) from the callback*



| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | The address which will receive the token0 and token1 amounts |
| amount0 | uint256 | The amount of token0 to send |
| amount1 | uint256 | The amount of token1 to send |
| data | bytes | Any data to be passed through to the callback |


### setCommunityFee


`function setCommunityFee(uint8 communityFee0, uint8 communityFee1) external`  external

Set the community&#x27;s % share of the fees. Cannot exceed 25% (250)



| Name | Type | Description |
| ---- | ---- | ----------- |
| communityFee0 | uint8 | new community fee percent for token0 of the pool in thousandths (1e-3) |
| communityFee1 | uint8 | new community fee percent for token1 of the pool in thousandths (1e-3) |


### setTickSpacing


`function setTickSpacing(int24 newTickSpacing) external`  external

Set the new tick spacing values. Only factory owner



| Name | Type | Description |
| ---- | ---- | ----------- |
| newTickSpacing | int24 | The new tick spacing value |


### setIncentive


`function setIncentive(address virtualPoolAddress) external`  external

Sets an active incentive



| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPoolAddress | address | The address of a virtual pool associated with the incentive |


### setLiquidityCooldown


`function setLiquidityCooldown(uint32 newLiquidityCooldown) external`  external

Sets new lock time for added liquidity



| Name | Type | Description |
| ---- | ---- | ----------- |
| newLiquidityCooldown | uint32 | The time in seconds |





