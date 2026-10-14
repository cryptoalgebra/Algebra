

# IAlgebraPlugin


The Algebra plugin interface



*Developer note: The plugin will be called by the pool using hook methods depending on the current pool settings*


## Functions
### defaultPluginConfig

```solidity
function defaultPluginConfig() external view returns (uint16)
```
**Selector**: `0x689ea370`

Returns plugin config

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint16 | config Each bit of the config is responsible for enabling/disabling the hooks. The last bit indicates whether the plugin contains dynamic fees logic |

### beforeInitialize

```solidity
function beforeInitialize(address sender, uint160 sqrtPriceX96) external returns (bytes4)
```
**Selector**: `0x636fd804`

The hook called before the state of a pool is initialized

| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The initial msg.sender for the initialize call |
| sqrtPriceX96 | uint160 | The sqrt(price) of the pool as a Q64.96 |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes4 | bytes4 The function selector for the hook |

### afterInitialize

```solidity
function afterInitialize(address sender, uint160 sqrtPriceX96, int24 tick) external returns (bytes4)
```
**Selector**: `0x82dd6522`

The hook called after the state of a pool is initialized

| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The initial msg.sender for the initialize call |
| sqrtPriceX96 | uint160 | The sqrt(price) of the pool as a Q64.96 |
| tick | int24 | The current tick after the state of a pool is initialized |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes4 | bytes4 The function selector for the hook |

### beforeModifyPosition

```solidity
function beforeModifyPosition(address sender, address recipient, int24 bottomTick, int24 topTick, int128 desiredLiquidityDelta, bytes data) external returns (bytes4 selector)
```
**Selector**: `0x5e2411b2`

The hook called before a position is modified

| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The initial msg.sender for the modify position call |
| recipient | address | Address to which the liquidity will be assigned in case of a mint or to which tokens will be sent in case of a burn |
| bottomTick | int24 | The lower tick of the position |
| topTick | int24 | The upper tick of the position |
| desiredLiquidityDelta | int128 | The desired amount of liquidity to mint/burn |
| data | bytes | Data that passed through the callback |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| selector | bytes4 | The function selector for the hook |

### afterModifyPosition

```solidity
function afterModifyPosition(address sender, address recipient, int24 bottomTick, int24 topTick, int128 desiredLiquidityDelta, uint256 amount0, uint256 amount1, bytes data) external returns (bytes4)
```
**Selector**: `0xd6852010`

The hook called after a position is modified

| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The initial msg.sender for the modify position call |
| recipient | address | Address to which the liquidity will be assigned in case of a mint or to which tokens will be sent in case of a burn |
| bottomTick | int24 | The lower tick of the position |
| topTick | int24 | The upper tick of the position |
| desiredLiquidityDelta | int128 | The desired amount of liquidity to mint/burn |
| amount0 | uint256 | The amount of token0 sent to the recipient or was paid to mint |
| amount1 | uint256 | The amount of token0 sent to the recipient or was paid to mint |
| data | bytes | Data that passed through the callback |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes4 | bytes4 The function selector for the hook |

### beforeSwap

```solidity
function beforeSwap(address sender, address recipient, bool zeroToOne, int256 amountRequired, uint160 limitSqrtPrice, bool withPaymentInAdvance, bytes data) external returns (uint256 amountInDecrease, bytes4 selector, uint24 feeOverride)
```
**Selector**: `0x029c1cb7`

The hook called before a swap

| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The initial msg.sender for the swap call |
| recipient | address | The address to receive the output of the swap |
| zeroToOne | bool | The direction of the swap, true for token0 to token1, false for token1 to token0 |
| amountRequired | int256 | The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative). In `swapWithPaymentInAdvance` it is the amount actually received by the pool |
| limitSqrtPrice | uint160 | The Q64.96 sqrt price limit. If zero for one, the price cannot be less than this value after the swap. If one for zero, the price cannot be greater than this value after the swap |
| withPaymentInAdvance | bool | The flag indicating whether the `swapWithPaymentInAdvance` method was called |
| data | bytes | Data that passed through the callback |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountInDecrease | uint256 | The part of the input that goes to the plugin instead of being swapped (exactIn only). It is charged in full even if the swap is executed partially. Must be zero if the amount deltas are disabled |
| selector | bytes4 | The function selector for the hook |
| feeOverride | uint24 | The fee for this swap if the dynamic fee is enabled, zero meaning a zero fee, not the pool fee. Must be zero if the dynamic fee is disabled |

### afterSwapCalculation

```solidity
function afterSwapCalculation(address sender, address recipient, bool zeroToOne, int256 amountRequired, uint160 limitSqrtPrice, int256 amount0, int256 amount1, bytes data) external returns (bytes4 selector, uint256 amountInIncrease, uint256 amountOutDecrease)
```
**Selector**: `0xef280aba`

The hook called after swap calculation, before any tokens are transferred

| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The initial msg.sender for the swap call |
| recipient | address | The address to receive the output of the swap |
| zeroToOne | bool | The direction of the swap, true for token0 to token1, false for token1 to token0 |
| amountRequired | int256 | The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative). In `swapWithPaymentInAdvance` it is the amount actually received by the pool |
| limitSqrtPrice | uint160 | The Q64.96 sqrt price limit. If zero for one, the price cannot be less than this value after the swap. If one for zero, the price cannot be greater than this value after the swap |
| amount0 | int256 | The swapped amount of token0, without plugin deltas |
| amount1 | int256 | The swapped amount of token1, without plugin deltas |
| data | bytes | Data that passed through the callback |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| selector | bytes4 | The function selector for the hook |
| amountInIncrease | uint256 | The amount to increase input (for exactOut case), goes to the plugin |
| amountOutDecrease | uint256 | The amount to decrease output (for exactIn case), goes to the plugin. Both amounts must be zero if the amount deltas are disabled |

### afterSwap

```solidity
function afterSwap(address sender, address recipient, bool zeroToOne, int256 amountRequired, uint160 limitSqrtPrice, int256 amount0, int256 amount1, uint256 feeAmount, bytes data) external returns (bytes4)
```
**Selector**: `0x4c0c5f21`

The hook called after a swap

| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The initial msg.sender for the swap call |
| recipient | address | The address to receive the output of the swap |
| zeroToOne | bool | The direction of the swap, true for token0 to token1, false for token1 to token0 |
| amountRequired | int256 | The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative). In `swapWithPaymentInAdvance` it is the amount actually received by the pool |
| limitSqrtPrice | uint160 | The Q64.96 sqrt price limit. If zero for one, the price cannot be less than this value after the swap. If one for zero, the price cannot be greater than this value after the swap |
| amount0 | int256 | The amount of token0 paid by the caller (positive) or sent to the recipient (negative) |
| amount1 | int256 | The amount of token1 paid by the caller (positive) or sent to the recipient (negative) |
| feeAmount | uint256 | The swap fee (before community fee deduction) not passed to the plugin in `afterCross`: the whole fee if `afterCross` is disabled, otherwise the fee after the last crossed tick. In the fee token, see `feeMode` |
| data | bytes | Data that passed through the callback |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes4 | bytes4 The function selector for the hook |

### beforeFlash

```solidity
function beforeFlash(address sender, address recipient, uint256 amount0, uint256 amount1, bytes data) external returns (bytes4)
```
**Selector**: `0x8de0a8ee`

The hook called before flash

| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The initial msg.sender for the flash call |
| recipient | address | The address which will receive the token0 and token1 amounts |
| amount0 | uint256 | The amount of token0 being requested for flash |
| amount1 | uint256 | The amount of token1 being requested for flash |
| data | bytes | Data that passed through the callback |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes4 | bytes4 The function selector for the hook |

### afterFlash

```solidity
function afterFlash(address sender, address recipient, uint256 amount0, uint256 amount1, uint256 paid0, uint256 paid1, bytes data) external returns (bytes4)
```
**Selector**: `0x343d37ff`

The hook called after flash

| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The initial msg.sender for the flash call |
| recipient | address | The address which will receive the token0 and token1 amounts |
| amount0 | uint256 | The amount of token0 being requested for flash |
| amount1 | uint256 | The amount of token1 being requested for flash |
| paid0 | uint256 | The amount of token0 being paid for flash |
| paid1 | uint256 | The amount of token1 being paid for flash |
| data | bytes | Data that passed through the callback |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes4 | bytes4 The function selector for the hook |

### afterCross

```solidity
function afterCross(bool zeroToOne, uint256 swapStepAmount, uint256 feeStepAmount, int24 tick, int128 liquidityDelta, uint128 liquidity) external returns (bytes4)
```
**Selector**: `0x3c08d3e2`

The hook called after crossing an initialized tick during a swap

| Name | Type | Description |
| ---- | ---- | ----------- |
| zeroToOne | bool | The direction of the swap |
| swapStepAmount | uint256 | The input amount of the swap step, without the fee |
| feeStepAmount | uint256 | The fee amount of the swap step (before community fee deduction), in the fee token, see `feeMode` |
| tick | int24 | The tick that was crossed |
| liquidityDelta | int128 | The liquidity delta at the crossed tick |
| liquidity | uint128 | The active liquidity of the swap step, before the tick is crossed |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes4 | bytes4 The function selector for the hook |

