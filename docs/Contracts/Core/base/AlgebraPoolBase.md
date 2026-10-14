

# AlgebraPoolBase


Algebra pool base abstract contract

Contains state variables, immutables and common internal functions

*Developer note: Decoupling into a separate abstract contract simplifies testing*

**Inherits:** [IAlgebraPool](../interfaces/IAlgebraPool.md) Timestamp
## Modifiers
### onlyValidTicks

```solidity
modifier onlyValidTicks(int24 bottomTick, int24 topTick)
```

Check that the lower and upper ticks do not violate the boundaries of allowed ticks and are specified in the correct order

| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 |  |
| topTick | int24 |  |


## Structs
### GlobalState

The struct with important state values of pool

*Developer note: fits into one storage slot*

```solidity
struct GlobalState {
  uint160 price;
  int24 tick;
  uint16 lastFee;
  uint16 pluginConfig;
  uint16 communityFee;
  bool unlocked;
}
```

| Name | Description |
| ---- | ----------- |
| price | The square root of the current price in Q64.96 format |
| tick | The current tick (price(tick) <= current price). May not always be equal to SqrtTickMath.getTickAtSqrtRatio(price) if the price is on a tick boundary |
| lastFee | The pool fee in hundredths of a bip, i.e. 1e-6 (so 100 is 0.01%). Not applied to swaps that get the fee from the dynamic fee plugin |
| pluginConfig | The current plugin config as bitmap. Each bit enables a hook or a feature (dynamic fee, amount deltas), see `Plugins` |
| communityFee | The community fee represented as a percent of all collected fee in thousandths, i.e. 1e-3 (so 100 is 10%) |
| unlocked | Reentrancy lock flag, true if the pool currently is unlocked, otherwise - false |


## Public variables
### maxLiquidityPerTick
```solidity
uint128 constant maxLiquidityPerTick = 191757638537527648490752896198553
```
**Selector**: `0x70cf754a`

The maximum amount of position liquidity that can use any tick in the range

*Developer note: This parameter is enforced per tick to prevent liquidity from overflowing a uint128 at any point, and
also prevents out-of-range liquidity from being used to prevent adding in-range liquidity to a pool*

### factory
```solidity
address immutable factory
```
**Selector**: `0xc45a0155`

The Algebra factory contract, which must adhere to the IAlgebraFactory interface


### token0
```solidity
address immutable token0
```
**Selector**: `0x0dfe1681`

The first of the two tokens of the pool, sorted by address


### token1
```solidity
address immutable token1
```
**Selector**: `0xd21220a7`

The second of the two tokens of the pool, sorted by address


### deployer
```solidity
address immutable deployer
```
**Selector**: `0xd5f39488`

The custom deployer the pool was created with, part of the pool address computation for custom pools


### algebraPoolExtension
```solidity
address immutable algebraPoolExtension
```
**Selector**: `0xfdd68635`

The address of the pool extension contract used for delegatecall


### totalFeeGrowth0Token
```solidity
uint256 totalFeeGrowth0Token
```
**Selector**: `0x6378ae44`

The fee growth as a Q128.128 fees of token0 collected per unit of liquidity for the entire life of the pool

*Developer note: This value can overflow the uint256*

### totalFeeGrowth1Token
```solidity
uint256 totalFeeGrowth1Token
```
**Selector**: `0xecdecf42`

The fee growth as a Q128.128 fees of token1 collected per unit of liquidity for the entire life of the pool

*Developer note: This value can overflow the uint256*

### globalState
```solidity
struct AlgebraPoolBase.GlobalState globalState
```
**Selector**: `0xe76c01e4`

The globalState structure in the pool stores many values but requires only one slot
and is exposed as a single method to save gas when accessed externally.

*Developer note: **important security note: caller should check &#x60;unlocked&#x60; flag to prevent read-only reentrancy***

### ticks
```solidity
mapping(int24 => struct TickManagement.Tick) ticks
```
**Selector**: `0xf30dba93`

Look up information about a specific tick in the pool

*Developer note: **important security note: caller should check reentrancy lock to prevent read-only reentrancy***

### plugin
```solidity
address plugin
```
**Selector**: `0xef01df4f`

Returns the address of currently used plugin

*Developer note: The plugin is subject to change*

### communityVault
```solidity
address communityVault
```
**Selector**: `0x53e97868`

The contract to which community fees are transferred


### tickTable
```solidity
mapping(int16 => uint256) tickTable
```
**Selector**: `0xc677e3e0`

Returns 256 packed tick initialized boolean values. See TickTree for more information


### nextTickGlobal
```solidity
int24 nextTickGlobal
```
**Selector**: `0xd5c35a7e`

The next initialized tick after current global tick

*Developer note: **important security note: caller should check reentrancy lock to prevent read-only reentrancy***

### prevTickGlobal
```solidity
int24 prevTickGlobal
```
**Selector**: `0x050a4d21`

The previous initialized tick before (or at) current global tick

*Developer note: **important security note: caller should check reentrancy lock to prevent read-only reentrancy***

### liquidity
```solidity
uint128 liquidity
```
**Selector**: `0x1a686502`

The currently in range liquidity available to the pool

*Developer note: This value has no relationship to the total liquidity across all ticks.
Returned value cannot exceed type(uint128).max
**important security note: caller should check reentrancy lock to prevent read-only reentrancy***

### tickSpacing
```solidity
int24 tickSpacing
```
**Selector**: `0xd0c93a7c`

The current tick spacing

*Developer note: Ticks can only be initialized by new mints at multiples of this value
e.g.: a tickSpacing of 60 means ticks can be initialized every 60th tick, i.e., ..., -120, -60, 0, 60, 120, ...
However, tickspacing can be changed after the ticks have been initialized.
This value is an int24 to avoid casting even though it is always positive.*

### feeMode
```solidity
uint8 feeMode
```
**Selector**: `0xb188c70d`

The token in which the swap fee is collected: 0 - the input token of each swap, 1 - always token0, 2 - always token1

*Developer note: Not in &#x60;globalState&#x60; to keep its interface as in 1.2, this slot is read on each swap anyway*


## Functions
### safelyGetStateOfAMM

```solidity
function safelyGetStateOfAMM() external view returns (uint160 sqrtPrice, int24 tick, uint16 lastFee, uint16 pluginConfig, uint128 activeLiquidity, int24 nextTick, int24 previousTick)
```
**Selector**: `0x97ce1c51`

Safely get most important state values of Algebra Integral AMM

*Developer note: safe from read-only reentrancy getter function*

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| sqrtPrice | uint160 | The current price of the pool as a sqrt(dToken1/dToken0) Q64.96 value |
| tick | int24 | The current global tick of the pool. May not always be equal to SqrtTickMath.getTickAtSqrtRatio(price) if the price is on a tick boundary |
| lastFee | uint16 | The pool fee value in hundredths of a bip, i.e. 1e-6 (so '100' is '0.01%'). Not applied to swaps that get the fee from the dynamic fee plugin |
| pluginConfig | uint16 | The current plugin config as bitmap. Each bit enables a hook or a feature (dynamic fee, amount deltas), see `Plugins` |
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

### getCommunityFeePending

```solidity
function getCommunityFeePending() external view returns (uint128, uint128)
```
**Selector**: `0x7bd78025`

The amounts of token0 and token1 accumulated for the vault

*Developer note: The vault claims them with &#x60;claimCommunityFee&#x60;*

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 |  |
| [1] | uint128 |  |

### getSwapFee

```solidity
function getSwapFee(address sender, address recipient, bool zeroToOne, int256 amountRequired, uint160 limitSqrtPrice, bool withPaymentInAdvance, bytes data) external view returns (uint24 fee)
```
**Selector**: `0xd67f0f1d`

The fee for a swap with the given parameters: the one from the dynamic fee plugin if enabled, otherwise the pool fee

*Developer note: The parameters are the ones the &#x60;beforeSwap&#x60; hook gets. The dynamic fee may differ from the fee of the actual swap
if the plugin changes its state in the &#x60;beforeSwap&#x60; hook, see the &#x60;SwapFee&#x60; event for the fee applied to each swap.
Swaps by the plugin itself (&#x60;sender&#x60; is the plugin) pay the pool fee, as the hook is not called for them.
Reverts if the dynamic fee is enabled but the plugin does not implement &#x60;IAlgebraDynamicFeePlugin&#x60;
**important security note: caller should check reentrancy lock to prevent read-only reentrancy***

| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The address that would call the swap |
| recipient | address | The address to receive the output of the swap |
| zeroToOne | bool | The direction of the swap, true for token0 to token1, false for token1 to token0 |
| amountRequired | int256 | The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative) |
| limitSqrtPrice | uint160 | The Q64.96 sqrt price limit |
| withPaymentInAdvance | bool | The flag indicating whether the `swapWithPaymentInAdvance` method would be called |
| data | bytes | Data that would be passed through the callback |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| fee | uint24 | The swap fee in hundredths of a bip, i.e. 1e-6 |

