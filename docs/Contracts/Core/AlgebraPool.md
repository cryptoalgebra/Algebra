

# AlgebraPool




## Modifiers
### onlyFactoryOwner









### onlyValidTicks











## Variables
### mapping(bytes32 &#x3D;&gt; struct AlgebraPool.Position) positions 

Returns the information about a position by the position&#x27;s key


## Functions
### constructor

PoolImmutables

`constructor()`  public







### timepoints


`timepoints(uint256)` view external

Returns data about a specific timepoint index



| Name | Type | Description |
| ---- | ---- | ----------- |
| index | uint256 | The element of the timepoints array to fetch |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| initialized | bool |  |
| blockTimestamp | uint32 |  |
| tickCumulative | int56 |  |
| secondsPerLiquidityCumulative | uint160 |  |
| volatilityCumulative | uint88 |  |
| averageTick | int24 |  |
| volumePerLiquidityCumulative | uint144 |  |

### getInnerCumulatives

onlyValidTicks

`getInnerCumulatives(int24,int24)` view external

Returns a snapshot of the tick cumulative, seconds per liquidity and seconds inside a tick range



| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 | The lower tick of the range |
| topTick | int24 | The upper tick of the range |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| innerTickCumulative | int56 |  |
| innerSecondsSpentPerLiquidity | uint160 |  |
| innerSecondsSpent | uint32 |  |

### getTimepoints


`getTimepoints(uint32[])` view external

Returns the cumulative tick and liquidity as of each timestamp &#x60;secondsAgo&#x60; from the current block timestamp



| Name | Type | Description |
| ---- | ---- | ----------- |
| secondsAgos | uint32[] | From how long ago each cumulative tick and liquidity value should be returned |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| tickCumulatives | int56[] |  |
| secondsPerLiquidityCumulatives | uint160[] |  |
| volatilityCumulatives | uint112[] |  |
| volumePerAvgLiquiditys | uint256[] |  |

### initialize


`initialize(uint160)`  external

Sets the initial price for the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| initialPrice | uint160 |  |


### mint

lock, onlyValidTicks

`mint(address,address,int24,int24,uint128,bytes)`  external

Adds liquidity for the given recipient/bottomTick/topTick position



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
| amount0 | uint256 |  |
| amount1 | uint256 |  |
| liquidityActual | uint128 |  |

### collect

lock

`collect(address,int24,int24,uint128,uint128)`  external

Collects tokens owed to a position



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
| amount0 | uint128 |  |
| amount1 | uint128 |  |

### burn

lock, onlyValidTicks

`burn(int24,int24,uint128)`  external

Burn liquidity from the sender and account tokens owed for the liquidity to the position



| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 | The lower tick of the position for which to burn liquidity |
| topTick | int24 | The upper tick of the position for which to burn liquidity |
| amount | uint128 | How much liquidity to burn |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint256 |  |
| amount1 | uint256 |  |

### swap


`swap(address,bool,int256,uint160,bytes)`  external

Swap token0 for token1, or token1 for token0



| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | The address to receive the output of the swap |
| zeroToOne | bool | The direction of the swap, true for token0 to token1, false for token1 to token0 |
| amountRequired | int256 |  |
| limitSqrtPrice | uint160 | The Q64.96 sqrt price limit. If zero for one, the price cannot be less than this value after the swap. If one for zero, the price cannot be greater than this value after the swap |
| data | bytes | Any data to be passed through to the callback. If using the Router it should contain SwapRouter#SwapCallbackData |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | int256 |  |
| amount1 | int256 |  |

### swapSupportingFeeOnInputTokens


`swapSupportingFeeOnInputTokens(address,address,bool,int256,uint160,bytes)`  external

Swap token0 for token1, or token1 for token0 (tokens that have fee on transfer)



| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The address called this function (Comes from the Router) |
| recipient | address | The address to receive the output of the swap |
| zeroToOne | bool | The direction of the swap, true for token0 to token1, false for token1 to token0 |
| amountRequired | int256 |  |
| limitSqrtPrice | uint160 | The Q64.96 sqrt price limit. If zero for one, the price cannot be less than this value after the swap. If one for zero, the price cannot be greater than this value after the swap |
| data | bytes | Any data to be passed through to the callback. If using the Router it should contain SwapRouter#SwapCallbackData |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | int256 |  |
| amount1 | int256 |  |

### flash

lock

`flash(address,uint256,uint256,bytes)`  external

Receive token0 and/or token1 and pay it back, plus a fee, in the callback



| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | The address which will receive the token0 and token1 amounts |
| amount0 | uint256 | The amount of token0 to send |
| amount1 | uint256 | The amount of token1 to send |
| data | bytes | Any data to be passed through to the callback |


### setCommunityFee

lock, onlyFactoryOwner

`setCommunityFee(uint8,uint8)`  external

Set the community&#x27;s % share of the fees. Cannot exceed 25% (250)



| Name | Type | Description |
| ---- | ---- | ----------- |
| communityFee0 | uint8 | new community fee percent for token0 of the pool in thousandths (1e-3) |
| communityFee1 | uint8 | new community fee percent for token1 of the pool in thousandths (1e-3) |


### setIncentive


`setIncentive(address)`  external

Sets an active incentive



| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPoolAddress | address | The address of a virtual pool associated with the incentive |


### setLiquidityCooldown

onlyFactoryOwner

`setLiquidityCooldown(uint32)`  external

Sets new lock time for added liquidity



| Name | Type | Description |
| ---- | ---- | ----------- |
| newLiquidityCooldown | uint32 | The time in seconds |




---


