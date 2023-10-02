

# IAlgebraPoolState


Pool state that can change



*Developer note: Important security note: when using this data by external contracts, it is necessary to take into account the possibility
of manipulation (including read-only reentrancy).
This interface is based on the UniswapV3 interface, credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces*


## Functions
### safelyGetStateOfAMM

```solidity
function safelyGetStateOfAMM() external view returns (uint160 sqrtPrice, int24 tick, uint16 lastFee, uint8 pluginConfig, uint128 activeLiquidity, int24 nextTick, int24 previousTick)
```
**Selector**: `0x97ce1c51`

Safely get most important state values of Algebra Integral AMM

*Developer note: Several values exposed as a single method to save gas when accessed externally.
**Important security note: this method checks reentrancy lock and should be preferred in most cases**.*

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| sqrtPrice | uint160 | The current price of the pool as a sqrt(dToken1/dToken0) Q64.96 value |
| tick | int24 | The current global tick of the pool. May not always be equal to SqrtTickMath.getTickAtSqrtRatio(price) if the price is on a tick boundary |
| lastFee | uint16 | The current (last known) pool fee value in hundredths of a bip, i.e. 1e-6 (so '100' is '0.01%'). May be obsolete if using dynamic fee plugin |
| pluginConfig | uint8 | The current plugin config as bitmap. Each bit is responsible for enabling/disabling the hooks, the last bit turns on/off dynamic fees logic |
| activeLiquidity | uint128 | The currently in-range liquidity available to the pool |
| nextTick | int24 | The next initialized tick after current global tick |
| previousTick | int24 | The previous initialized tick before (or at) current global tick |

### isUnlocked

```solidity
function isUnlocked() external view returns (bool unlocked)
```
**Selector**: `0x8380edb7`

Allows to easily get current reentrancy lock status

*Developer note: can be used to prevent read-only reentrancy.
This method just returns &#x60;globalState.unlocked&#x60; value*

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| unlocked | bool | Reentrancy lock flag, true if the pool currently is unlocked, otherwise - false |

### globalState

```solidity
function globalState() external view returns (uint160 price, int24 tick, uint16 lastFee, uint8 pluginConfig, uint16 communityFee, bool unlocked)
```
**Selector**: `0xe76c01e4`

The globalState structure in the pool stores many values but requires only one slot
and is exposed as a single method to save gas when accessed externally.

*Developer note: **important security note: caller should check &#x60;unlocked&#x60; flag to prevent read-only reentrancy***

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| price | uint160 | The current price of the pool as a sqrt(dToken1/dToken0) Q64.96 value |
| tick | int24 | The current tick of the pool, i.e. according to the last tick transition that was run This value may not always be equal to SqrtTickMath.getTickAtSqrtRatio(price) if the price is on a tick boundary |
| lastFee | uint16 | The current (last known) pool fee value in hundredths of a bip, i.e. 1e-6 (so '100' is '0.01%'). May be obsolete if using dynamic fee plugin |
| pluginConfig | uint8 | The current plugin config as bitmap. Each bit is responsible for enabling/disabling the hooks, the last bit turns on/off dynamic fees logic |
| communityFee | uint16 | The community fee represented as a percent of all collected fee in thousandths, i.e. 1e-3 (so 100 is 10%) |
| unlocked | bool | Reentrancy lock flag, true if the pool currently is unlocked, otherwise - false |

### ticks

```solidity
function ticks(int24 tick) external view returns (uint256 liquidityTotal, int128 liquidityDelta, int24 prevTick, int24 nextTick, uint256 outerFeeGrowth0Token, uint256 outerFeeGrowth1Token)
```
**Selector**: `0xf30dba93`

Look up information about a specific tick in the pool

*Developer note: **important security note: caller should check reentrancy lock to prevent read-only reentrancy***

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
| outerFeeGrowth1Token | uint256 | The fee growth on the other side of the tick from the current tick in token1 In addition, these values are only relative and must be used only in comparison to previous snapshots for a specific position. |

### communityFeeLastTimestamp

```solidity
function communityFeeLastTimestamp() external view returns (uint32)
```
**Selector**: `0x1131b110`

The timestamp of the last sending of tokens to community vault

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 | The timestamp truncated to 32 bits |

### getCommunityFeePending

```solidity
function getCommunityFeePending() external view returns (uint128 communityFeePending0, uint128 communityFeePending1)
```
**Selector**: `0x7bd78025`

The amounts of token0 and token1 that will be sent to the vault

*Developer note: Will be sent COMMUNITY_FEE_TRANSFER_FREQUENCY after communityFeeLastTimestamp*

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| communityFeePending0 | uint128 | The amount of token0 that will be sent to the vault |
| communityFeePending1 | uint128 | The amount of token1 that will be sent to the vault |

### plugin

```solidity
function plugin() external view returns (address pluginAddress)
```
**Selector**: `0xef01df4f`

Returns the address of currently used plugin

*Developer note: The plugin is subject to change*

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| pluginAddress | address | The address of currently used plugin |

### tickTable

```solidity
function tickTable(int16 wordPosition) external view returns (uint256)
```
**Selector**: `0xc677e3e0`

Returns 256 packed tick initialized boolean values. See TickTree for more information

| Name | Type | Description |
| ---- | ---- | ----------- |
| wordPosition | int16 | Index of 256-bits word with ticks |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The 256-bits word with packed ticks info |

### totalFeeGrowth0Token

```solidity
function totalFeeGrowth0Token() external view returns (uint256)
```
**Selector**: `0x6378ae44`

The fee growth as a Q128.128 fees of token0 collected per unit of liquidity for the entire life of the pool

*Developer note: This value can overflow the uint256*

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The fee growth accumulator for token0 |

### totalFeeGrowth1Token

```solidity
function totalFeeGrowth1Token() external view returns (uint256)
```
**Selector**: `0xecdecf42`

The fee growth as a Q128.128 fees of token1 collected per unit of liquidity for the entire life of the pool

*Developer note: This value can overflow the uint256*

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The fee growth accumulator for token1 |

### fee

```solidity
function fee() external view returns (uint16 currentFee)
```
**Selector**: `0xddca3f43`

The current pool fee value

*Developer note: In case dynamic fee is enabled in the pool, this method will call the plugin to get the current fee.
If the plugin implements complex fee logic, this method may return an incorrect value or revert.
In this case, see the plugin implementation and related documentation.
**important security note: caller should check reentrancy lock to prevent read-only reentrancy***

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| currentFee | uint16 | The current pool fee value in hundredths of a bip, i.e. 1e-6 |

### getReserves

```solidity
function getReserves() external view returns (uint128 reserve0, uint128 reserve1)
```
**Selector**: `0x0902f1ac`

The tracked token0 and token1 reserves of pool

*Developer note: If at any time the real balance is larger, the excess will be transferred to liquidity providers as additional fee.
If the balance exceeds uint128, the excess will be sent to the communityVault.*

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reserve0 | uint128 | The last known reserve of token0 |
| reserve1 | uint128 | The last known reserve of token1 |

### positions

```solidity
function positions(bytes32 key) external view returns (uint256 liquidity, uint256 innerFeeGrowth0Token, uint256 innerFeeGrowth1Token, uint128 fees0, uint128 fees1)
```
**Selector**: `0x514ea4bf`

Returns the information about a position by the position&#x27;s key

*Developer note: **important security note: caller should check reentrancy lock to prevent read-only reentrancy***

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | bytes32 | The position's key is a packed concatenation of the owner address, bottomTick and topTick indexes |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidity | uint256 | The amount of liquidity in the position |
| innerFeeGrowth0Token | uint256 | Fee growth of token0 inside the tick range as of the last mint/burn/poke |
| innerFeeGrowth1Token | uint256 | Fee growth of token1 inside the tick range as of the last mint/burn/poke |
| fees0 | uint128 | The computed amount of token0 owed to the position as of the last mint/burn/poke |
| fees1 | uint128 | The computed amount of token1 owed to the position as of the last mint/burn/poke |

### liquidity

```solidity
function liquidity() external view returns (uint128)
```
**Selector**: `0x1a686502`

The currently in range liquidity available to the pool

*Developer note: This value has no relationship to the total liquidity across all ticks.
Returned value cannot exceed type(uint128).max
**important security note: caller should check reentrancy lock to prevent read-only reentrancy***

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 | The current in range liquidity |

### tickSpacing

```solidity
function tickSpacing() external view returns (int24)
```
**Selector**: `0xd0c93a7c`

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

```solidity
function prevTickGlobal() external view returns (int24)
```
**Selector**: `0x050a4d21`

The previous initialized tick before (or at) current global tick

*Developer note: **important security note: caller should check reentrancy lock to prevent read-only reentrancy***

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | int24 | The previous initialized tick |

### nextTickGlobal

```solidity
function nextTickGlobal() external view returns (int24)
```
**Selector**: `0xd5c35a7e`

The next initialized tick after current global tick

*Developer note: **important security note: caller should check reentrancy lock to prevent read-only reentrancy***

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | int24 | The next initialized tick |

### tickTreeRoot

```solidity
function tickTreeRoot() external view returns (uint32)
```
**Selector**: `0x578b9a36`

The root of tick search tree

*Developer note: Each bit corresponds to one node in the second layer of tick tree: &#x27;1&#x27; if node has at least one active bit.
**important security note: caller should check reentrancy lock to prevent read-only reentrancy***

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 | The root of tick search tree as bitmap |

### tickTreeSecondLayer

```solidity
function tickTreeSecondLayer(int16) external view returns (uint256)
```
**Selector**: `0xd8619037`

The second layer of tick search tree

*Developer note: Each bit in node corresponds to one node in the leafs layer (&#x60;tickTable&#x60;) of tick tree: &#x27;1&#x27; if leaf has at least one active bit.
**important security note: caller should check reentrancy lock to prevent read-only reentrancy***

| Name | Type | Description |
| ---- | ---- | ----------- |
|  | int16 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The node of tick search tree second layer |

