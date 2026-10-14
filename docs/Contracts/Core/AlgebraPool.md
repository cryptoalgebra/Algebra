

# AlgebraPool


Algebra concentrated liquidity pool

This contract is responsible for liquidity positions, swaps and flashloans

*Developer note: Version: Algebra Integral 1.3*

**Inherits:** [AlgebraPoolBase](base/AlgebraPoolBase.md) [TickStructure](base/TickStructure.md) ReentrancyGuard [Positions](base/Positions.md) SwapCalculation [ReservesManager](base/ReservesManager.md)

## Structs
### SwapEventParams



```solidity
struct SwapEventParams {
  uint160 currentPrice;
  int24 currentTick;
  uint128 currentLiquidity;
  uint24 fee;
  uint256 pluginAmountIn;
  uint256 pluginAmountOut;
}
```

### SwapCache



```solidity
struct SwapCache {
  address recipient;
  bool zeroToOne;
  int256 amountRequired;
  uint160 limitSqrtPrice;
  bytes data;
  uint24 fee;
  uint256 amountInDecrease;
}
```


## Functions
### initialize

```solidity
function initialize(uint160) external
```
**Selector**: `0xf637731d`

Sets the initial price for the pool

*Developer note: Price is represented as a sqrt(amountToken1/amountToken0) Q64.96 value
Initialization should be done in one transaction with pool creation to avoid front-running*

| Name | Type | Description |
| ---- | ---- | ----------- |
|  | uint160 |  |

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

*Developer note: The caller of this method receives a callback in the form of [IAlgebraSwapCallback#algebraSwapCallback](interfaces/callback/IAlgebraSwapCallback.md#algebraSwapCallback)
The amounts include plugin deltas. On exactOut the input is not limited by the pool, check it in the callback*

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
| amount0 | int256 | The amount of token0 paid by the caller (positive) or sent to the recipient (negative) |
| amount1 | int256 | The amount of token1 paid by the caller (positive) or sent to the recipient (negative) |

### swapWithPaymentInAdvance

```solidity
function swapWithPaymentInAdvance(address leftoversRecipient, address recipient, bool zeroToOne, int256 amountToSell, uint160 limitSqrtPrice, bytes data) external returns (int256 amount0, int256 amount1)
```
**Selector**: `0x9e4e0227`

Swap token0 for token1, or token1 for token0 with prepayment

*Developer note: The caller of this method receives a callback in the form of [IAlgebraSwapCallback#algebraSwapCallback](interfaces/callback/IAlgebraSwapCallback.md#algebraSwapCallback)
caller must send tokens in callback before swap calculation
the actually sent amount of tokens is used for further calculations
The amounts include plugin deltas and do not include the leftovers*

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
| amount0 | int256 | The amount of token0 spent by the caller (positive) or sent to the recipient (negative) |
| amount1 | int256 | The amount of token1 spent by the caller (positive) or sent to the recipient (negative) |

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
function setCommunityFee(uint16) external
```
**Selector**: `0x240a875a`

Set the community&#x27;s % share of the fees. Only factory owner or POOLS_ADMINISTRATOR_ROLE role

| Name | Type | Description |
| ---- | ---- | ----------- |
|  | uint16 |  |

### setFeeMode

```solidity
function setFeeMode(uint8) external
```
**Selector**: `0x5e6f1cb8`

Set the token in which the swap fee is collected. Only factory owner or POOLS_ADMINISTRATOR_ROLE role

*Developer note: The fee growth already accrued in the other token is not migrated, positions can still collect it*

| Name | Type | Description |
| ---- | ---- | ----------- |
|  | uint8 |  |

### setTickSpacing

```solidity
function setTickSpacing(int24) external
```
**Selector**: `0xf085a610`

Set the new tick spacing values. Only factory owner or POOLS_ADMINISTRATOR_ROLE role

| Name | Type | Description |
| ---- | ---- | ----------- |
|  | int24 |  |

### setPlugin

```solidity
function setPlugin(address) external
```
**Selector**: `0xcc1f97cf`

Set the new plugin address. Only factory owner or POOLS_ADMINISTRATOR_ROLE role

| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |

### setPluginConfig

```solidity
function setPluginConfig(uint16) external
```
**Selector**: `0x54884e9d`

Set new plugin config. Only factory owner or POOLS_ADMINISTRATOR_ROLE role

| Name | Type | Description |
| ---- | ---- | ----------- |
|  | uint16 |  |

### setCommunityVault

```solidity
function setCommunityVault(address) external
```
**Selector**: `0xd8544cf3`

Set new community fee vault address. Only factory owner or POOLS_ADMINISTRATOR_ROLE role

*Developer note: Community fee vault receives collected community fees.
**accumulated but not yet sent to the vault community fees once will be sent to the &#x60;newCommunityVault&#x60; address***

| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |

### setFee

```solidity
function setFee(uint16) external
```
**Selector**: `0x8e005553`

Set new pool fee. Can be called by owner if dynamic fee is disabled.
Called by the plugin if dynamic fee is enabled

| Name | Type | Description |
| ---- | ---- | ----------- |
|  | uint16 |  |

### sync

```solidity
function sync() external
```
**Selector**: `0xfff6cae9`

Forces balances to match reserves. Excessive tokens will be distributed between active LPs

*Developer note: Only plugin can call this function*

### skim

```solidity
function skim() external
```
**Selector**: `0x1dd19cb4`

Forces balances to match reserves. Excessive tokens will be sent to msg.sender

*Developer note: Only plugin can call this function*

### claimCommunityFee

```solidity
function claimCommunityFee() external returns (uint128 amount0, uint128 amount1)
```
**Selector**: `0x5dddf3e6`

Sends the accumulated community fees to the community vault

*Developer note: Only the community vault can call this function*

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint128 | The amount of token0 sent |
| amount1 | uint128 | The amount of token1 sent |

