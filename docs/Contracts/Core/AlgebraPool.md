

# AlgebraPool


Algebra concentrated liquidity pool

This contract is responsible for liquidity positions, swaps and flashloans

*Developer note: Version: Algebra Integral*

**Inherits:** [AlgebraPoolBase](base/AlgebraPoolBase.md) [TickStructure](base/TickStructure.md) ReentrancyGuard [Positions](base/Positions.md) SwapCalculation [ReservesManager](base/ReservesManager.md)

## Functions
### initialize

```solidity
function initialize(uint160 initialPrice) external
```
**Selector**: `0xf637731d`

Sets the initial price for the pool

*Developer note: Price is represented as a sqrt(amountToken1/amountToken0) Q64.96 value
Initialization should be done in one transaction with pool creation to avoid front-running*

| Name | Type | Description |
| ---- | ---- | ----------- |
| initialPrice | uint160 | The initial sqrt price of the pool as a Q64.96 |

### mint

```solidity
function mint(address leftoversRecipient, address recipient, int24 bottomTick, int24 topTick, uint128 liquidityDesired, bytes data) external returns (uint256 amount0, uint256 amount1, uint128 liquidityActual)
```
**Selector**: `0xaafe29c0`

Adds liquidity for the given recipient/bottomTick/topTick position

*Developer note: The caller of this method receives a callback in the form of [IAlgebraMintCallback#algebraMintCallback](interfaces/callback/IAlgebraMintCallback.md#algebraMintCallback)
in which they must pay any token0 or token1 owed for the liquidity. The amount of token0/token1 due depends
on bottomTick, topTick, the amount of liquidity, and the current price.*

| Name | Type | Description |
| ---- | ---- | ----------- |
| leftoversRecipient | address | The address which will receive potential surplus of paid tokens |
| recipient | address | The address for which the liquidity will be created |
| bottomTick | int24 | The lower tick of the position in which to add liquidity |
| topTick | int24 | The upper tick of the position in which to add liquidity |
| liquidityDesired | uint128 | The desired amount of liquidity to mint |
| data | bytes | Any data that should be passed through to the callback |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint256 | The amount of token0 that was paid to mint the given amount of liquidity. Matches the value in the callback |
| amount1 | uint256 | The amount of token1 that was paid to mint the given amount of liquidity. Matches the value in the callback |
| liquidityActual | uint128 | The actual minted amount of liquidity |

### burn

```solidity
function burn(int24 bottomTick, int24 topTick, uint128 amount, bytes data) external returns (uint256 amount0, uint256 amount1)
```
**Selector**: `0x3b3bc70e`

Burn liquidity from the sender and account tokens owed for the liquidity to the position

*Developer note: Can be used to trigger a recalculation of fees owed to a position by calling with an amount of 0
Fees must be collected separately via a call to [#collect](#collect)*

| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 | The lower tick of the position for which to burn liquidity |
| topTick | int24 | The upper tick of the position for which to burn liquidity |
| amount | uint128 | How much liquidity to burn |
| data | bytes | Any data that should be passed through to the plugin |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint256 | The amount of token0 sent to the recipient |
| amount1 | uint256 | The amount of token1 sent to the recipient |

### collect

```solidity
function collect(address recipient, int24 bottomTick, int24 topTick, uint128 amount0Requested, uint128 amount1Requested) external returns (uint128 amount0, uint128 amount1)
```
**Selector**: `0x4f1eb3d8`

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

### swap

```solidity
function swap(address recipient, bool zeroToOne, int256 amountRequired, uint160 limitSqrtPrice, bytes data) external returns (int256 amount0, int256 amount1)
```
**Selector**: `0x128acb08`

Swap token0 for token1, or token1 for token0

*Developer note: The caller of this method receives a callback in the form of [IAlgebraSwapCallback#algebraSwapCallback](interfaces/callback/IAlgebraSwapCallback.md#algebraSwapCallback)*

| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | The address to receive the output of the swap |
| zeroToOne | bool | The direction of the swap, true for token0 to token1, false for token1 to token0 |
| amountRequired | int256 | The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative) |
| limitSqrtPrice | uint160 | The Q64.96 sqrt price limit. If zero for one, the price cannot be less than this value after the swap. If one for zero, the price cannot be greater than this value after the swap |
| data | bytes | Any data to be passed through to the callback. If using the Router it should contain [SwapRouter#SwapCallbackData](../Periphery/SwapRouter.md#SwapCallbackData) |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | int256 | The delta of the balance of token0 of the pool, exact when negative, minimum when positive |
| amount1 | int256 | The delta of the balance of token1 of the pool, exact when negative, minimum when positive |

### swapWithPaymentInAdvance

```solidity
function swapWithPaymentInAdvance(address leftoversRecipient, address recipient, bool zeroToOne, int256 amountToSell, uint160 limitSqrtPrice, bytes data) external returns (int256 amount0, int256 amount1)
```
**Selector**: `0x9e4e0227`

Swap token0 for token1, or token1 for token0 with prepayment

*Developer note: The caller of this method receives a callback in the form of [IAlgebraSwapCallback#algebraSwapCallback](interfaces/callback/IAlgebraSwapCallback.md#algebraSwapCallback)
caller must send tokens in callback before swap calculation
the actually sent amount of tokens is used for further calculations*

| Name | Type | Description |
| ---- | ---- | ----------- |
| leftoversRecipient | address | The address which will receive potential surplus of paid tokens |
| recipient | address | The address to receive the output of the swap |
| zeroToOne | bool | The direction of the swap, true for token0 to token1, false for token1 to token0 |
| amountToSell | int256 | The amount of the swap, only positive (exact input) amount allowed |
| limitSqrtPrice | uint160 | The Q64.96 sqrt price limit. If zero for one, the price cannot be less than this value after the swap. If one for zero, the price cannot be greater than this value after the swap |
| data | bytes | Any data to be passed through to the callback. If using the Router it should contain [SwapRouter#SwapCallbackData](../Periphery/SwapRouter.md#SwapCallbackData) |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | int256 | The delta of the balance of token0 of the pool, exact when negative, minimum when positive |
| amount1 | int256 | The delta of the balance of token1 of the pool, exact when negative, minimum when positive |

### flash

```solidity
function flash(address recipient, uint256 amount0, uint256 amount1, bytes data) external
```
**Selector**: `0x490e6cbc`

Receive token0 and/or token1 and pay it back, plus a fee, in the callback

*Developer note: The caller of this method receives a callback in the form of [IAlgebraFlashCallback#algebraFlashCallback](interfaces/callback/IAlgebraFlashCallback.md#algebraFlashCallback)
All excess tokens paid in the callback are distributed to currently in-range liquidity providers as an additional fee.
If there are no in-range liquidity providers, the fee will be transferred to the first active provider in the future*

| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | The address which will receive the token0 and token1 amounts |
| amount0 | uint256 | The amount of token0 to send |
| amount1 | uint256 | The amount of token1 to send |
| data | bytes | Any data to be passed through to the callback |

### setCommunityFee

```solidity
function setCommunityFee(uint16 newCommunityFee) external
```
**Selector**: `0x240a875a`

Set the community&#x27;s % share of the fees. Only factory owner or POOLS_ADMINISTRATOR_ROLE role

| Name | Type | Description |
| ---- | ---- | ----------- |
| newCommunityFee | uint16 | The new community fee percent in thousandths (1e-3) |

### setTickSpacing

```solidity
function setTickSpacing(int24 newTickSpacing) external
```
**Selector**: `0xf085a610`

Set the new tick spacing values. Only factory owner or POOLS_ADMINISTRATOR_ROLE role

| Name | Type | Description |
| ---- | ---- | ----------- |
| newTickSpacing | int24 | The new tick spacing value |

### setPlugin

```solidity
function setPlugin(address newPluginAddress) external
```
**Selector**: `0xcc1f97cf`

Set the new plugin address. Only factory owner or POOLS_ADMINISTRATOR_ROLE role

| Name | Type | Description |
| ---- | ---- | ----------- |
| newPluginAddress | address | The new plugin address |

### setPluginConfig

```solidity
function setPluginConfig(uint8 newConfig) external
```
**Selector**: `0xbca57f81`

Set new plugin config

| Name | Type | Description |
| ---- | ---- | ----------- |
| newConfig | uint8 | In the new configuration of the plugin, each bit of which is responsible for a particular hook. Only factory owner or POOLS_ADMINISTRATOR_ROLE role |

### setFee

```solidity
function setFee(uint16 newFee) external
```
**Selector**: `0x8e005553`

Set new pool fee. Can be called by owner if dynamic fee is disabled.
Called by the plugin if dynamic fee is enabled

| Name | Type | Description |
| ---- | ---- | ----------- |
| newFee | uint16 | The new fee value |

