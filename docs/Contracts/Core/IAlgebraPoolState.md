

# IAlgebraPoolState


Pool state that can change



*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces*




## Functions
### globalState


`function globalState() external view returns (uint160 price, int24 tick, uint16 fee, uint8 pluginConfig, uint16 communityFee, bool unlocked)` view external

The globalState structure in the pool stores many values but requires only one slot
and is exposed as a single method to save gas when accessed externally.




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| price | uint160 | The current price of the pool as a sqrt(dToken1/dToken0) Q64.96 value |
| tick | int24 | The current tick of the pool, i.e. according to the last tick transition that was run This value may not always be equal to SqrtTickMath.getTickAtSqrtRatio(price) if the price is on a tick boundary |
| fee | uint16 | The last known pool fee value in hundredths of a bip, i.e. 1e-6 |
| pluginConfig | uint8 | The current plugin config. Each bit of the config is responsible for enabling/disabling the hooks The last bit indicates whether the plugin contains dynamic fees logic |
| communityFee | uint16 | The community fee percentage of the swap fee in thousandths (1e-3) |
| unlocked | bool | Whether the pool is currently locked to reentrancy |

### ticks


`function ticks(int24 tick) external view returns (uint256 liquidityTotal, int128 liquidityDelta, int24 prevTick, int24 nextTick, uint256 outerFeeGrowth0Token, uint256 outerFeeGrowth1Token)` view external

Look up information about a specific tick in the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| tick | int24 | The tick to look up |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidityTotal | uint256 | The total amount of position liquidity that uses the pool either as tick lower or tick upper |
| liquidityDelta | int128 | How much liquidity changes when the pool price crosses the tick |
| prevTick | int24 | The previous tick in tick list |
| nextTick | int24 | The next tick in tick list |
| outerFeeGrowth0Token | uint256 | The fee growth on the other side of the tick from the current tick in token0 |
| outerFeeGrowth1Token | uint256 | The fee growth on the other side of the tick from the current tick in token1 In addition, these values are only relative and must be used only in comparison to previous snapshots for a specific position. |

### communityFeeLastTimestamp


`function communityFeeLastTimestamp() external view returns (uint32)` view external

The timestamp of the last sending of tokens to community vault




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 | The timestamp truncated to 32 bits |

### getCommunityFeePending


`function getCommunityFeePending() external view returns (uint128 communityFeePending0, uint128 communityFeePending1)` view external

The amounts of token0 and token1 that will be sent to the vault
*Developer note: Will be sent COMMUNITY_FEE_TRANSFER_FREQUENCY after communityFeeLastTimestamp*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| communityFeePending0 | uint128 | The amount of token0 that will be sent to the vault |
| communityFeePending1 | uint128 | The amount of token1 that will be sent to the vault |

### plugin


`function plugin() external view returns (address pluginAddress)` view external

Returns the address of currently used plugin
*Developer note: The plugin is subject to change*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| pluginAddress | address | The address of currently used plugin |

### tickTable


`function tickTable(int16 wordPosition) external view returns (uint256)` view external

Returns 256 packed tick initialized boolean values. See TickTree for more information



| Name | Type | Description |
| ---- | ---- | ----------- |
| wordPosition | int16 | Index of 256-bits word with ticks |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The 256-bits word with packed ticks info |

### totalFeeGrowth0Token


`function totalFeeGrowth0Token() external view returns (uint256)` view external

The fee growth as a Q128.128 fees of token0 collected per unit of liquidity for the entire life of the pool
*Developer note: This value can overflow the uint256*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The fee growth accumulator for token0 |

### totalFeeGrowth1Token


`function totalFeeGrowth1Token() external view returns (uint256)` view external

The fee growth as a Q128.128 fees of token1 collected per unit of liquidity for the entire life of the pool
*Developer note: This value can overflow the uint256*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The fee growth accumulator for token1 |

### fee


`function fee() external view returns (uint16 currentFee)` view external

The current pool fee value
*Developer note: In case dynamic fee is enabled in the pool, this method will call the plugin to get the current fee.
If the plugin implements complex fee logic, this method may return an incorrect value or revert.
In this case, see the plugin implementation and related documentation.*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| currentFee | uint16 | The current pool fee value in hundredths of a bip, i.e. 1e-6 |

### getReserves


`function getReserves() external view returns (uint128 reserve0, uint128 reserve1)` view external

The tracked token0 and token1 reserves of pool
*Developer note: If at any time the real balance is larger, the excess will be transferred to liquidity providers as additional fee.
If the balance exceeds uint128, the excess will be sent to the communityVault.*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reserve0 | uint128 | The last known reserve of token0 |
| reserve1 | uint128 | The last known reserve of token1 |

### positions


`function positions(bytes32 key) external view returns (uint256 liquidity, uint256 innerFeeGrowth0Token, uint256 innerFeeGrowth1Token, uint128 fees0, uint128 fees1)` view external

Returns the information about a position by the position&#x27;s key



| Name | Type | Description |
| ---- | ---- | ----------- |
| key | bytes32 | The position&#x27;s key is a packed concatenation of the owner address, bottomTick and topTick indexes |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidity | uint256 | The amount of liquidity in the position |
| innerFeeGrowth0Token | uint256 | Fee growth of token0 inside the tick range as of the last mint/burn/poke |
| innerFeeGrowth1Token | uint256 | Fee growth of token1 inside the tick range as of the last mint/burn/poke |
| fees0 | uint128 | The computed amount of token0 owed to the position as of the last mint/burn/poke |
| fees1 | uint128 | The computed amount of token1 owed to the position as of the last mint/burn/poke |

### liquidity


`function liquidity() external view returns (uint128)` view external

The currently in range liquidity available to the pool
*Developer note: This value has no relationship to the total liquidity across all ticks.
Returned value cannot exceed type(uint128).max*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 | The current in range liquidity |

### tickSpacing


`function tickSpacing() external view returns (int24)` view external

The current tick spacing
*Developer note: Ticks can only be initialized by new mints at multiples of this value
e.g.: a tickSpacing of 60 means ticks can be initialized every 60th tick, i.e., ..., -120, -60, 0, 60, 120, ...
However, tickspacing can be changed after the ticks have been initialized.
This value is an int24 to avoid casting even though it is always positive.*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | int24 | The current tick spacing |

### prevTickGlobal


`function prevTickGlobal() external view returns (int24)` view external

The previous initialized tick before (or at) current global tick




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | int24 | The previous initialized tick |

### nextTickGlobal


`function nextTickGlobal() external view returns (int24)` view external

The next initialized tick after current global tick




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | int24 | The next initialized tick |




