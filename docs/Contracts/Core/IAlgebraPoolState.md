

# IAlgebraPoolState







## Functions
### globalState


`globalState()` view external

The globalState structure in the pool stores many values but requires only one slot
and is exposed as a single method to save gas when accessed externally.




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| price | uint160 |  |
| tick | int24 |  |
| fee | uint16 |  |
| timepointIndex | uint16 |  |
| communityFeeToken0 | uint8 |  |
| communityFeeToken1 | uint8 |  |
| unlocked | bool |  |

### totalFeeGrowth0Token


`totalFeeGrowth0Token()` view external

The fee growth as a Q128.128 fees of token0 collected per unit of liquidity for the entire life of the pool




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### totalFeeGrowth1Token


`totalFeeGrowth1Token()` view external

The fee growth as a Q128.128 fees of token1 collected per unit of liquidity for the entire life of the pool




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### liquidity


`liquidity()` view external

The currently in range liquidity available to the pool




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 |  |

### ticks


`ticks(int24)` view external

Look up information about a specific tick in the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| tick | int24 | The tick to look up |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidityTotal | uint128 |  |
| liquidityDelta | int128 |  |
| outerFeeGrowth0Token | uint256 |  |
| outerFeeGrowth1Token | uint256 |  |
| outerTickCumulative | int56 |  |
| outerSecondsPerLiquidity | uint160 |  |
| outerSecondsSpent | uint32 |  |
| initialized | bool |  |

### tickTable


`tickTable(int16)` view external

Returns 256 packed tick initialized boolean values. See TickTable for more information



| Name | Type | Description |
| ---- | ---- | ----------- |
| wordPosition | int16 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### positions


`positions(bytes32)` view external

Returns the information about a position by the position&#x27;s key



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | bytes32 | The position&#x27;s key is a hash of a preimage composed by the owner, bottomTick and topTick |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidityAmount | uint128 |  |
| lastLiquidityAddTimestamp | uint32 |  |
| innerFeeGrowth0Token | uint256 |  |
| innerFeeGrowth1Token | uint256 |  |
| fees0 | uint128 |  |
| fees1 | uint128 |  |

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

### activeIncentive


`activeIncentive()` view external

Returns the information about active incentive




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPool | address |  |

### liquidityCooldown


`liquidityCooldown()` view external

Returns the lock time for added liquidity




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| cooldownInSeconds | uint32 |  |



---


