

# IAlgebraPlugin


The Algebra plugin interface



*Developer note: The plugin will be called by the pool using hook methods depending on the current pool settings*


## Functions
### defaultPluginConfig

```solidity
function defaultPluginConfig() external view returns (uint8)
```
**Selector**: `0x689ea370`

Returns plugin config

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint8 | config Each bit of the config is responsible for enabling/disabling the hooks. The last bit indicates whether the plugin contains dynamic fees logic |

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
function beforeModifyPosition(address sender, address recipient, int24 bottomTick, int24 topTick, int128 desiredLiquidityDelta, bytes data) external returns (bytes4)
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
| [0] | bytes4 | bytes4 The function selector for the hook |

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
function beforeSwap(address sender, address recipient, bool zeroToOne, int256 amountRequired, uint160 limitSqrtPrice, bool withPaymentInAdvance, bytes data) external returns (bytes4)
```
**Selector**: `0x029c1cb7`

The hook called before a swap

| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The initial msg.sender for the swap call |
| recipient | address | The address to receive the output of the swap |
| zeroToOne | bool | The direction of the swap, true for token0 to token1, false for token1 to token0 |
| amountRequired | int256 | The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative) |
| limitSqrtPrice | uint160 | The Q64.96 sqrt price limit. If zero for one, the price cannot be less than this value after the swap. If one for zero, the price cannot be greater than this value after the swap |
| withPaymentInAdvance | bool | The flag indicating whether the `swapWithPaymentInAdvance` method was called |
| data | bytes | Data that passed through the callback |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes4 | bytes4 The function selector for the hook |

### afterSwap

```solidity
function afterSwap(address sender, address recipient, bool zeroToOne, int256 amountRequired, uint160 limitSqrtPrice, int256 amount0, int256 amount1, bytes data) external returns (bytes4)
```
**Selector**: `0x9cb5a963`

The hook called after a swap

| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The initial msg.sender for the swap call |
| recipient | address | The address to receive the output of the swap |
| zeroToOne | bool | The direction of the swap, true for token0 to token1, false for token1 to token0 |
| amountRequired | int256 | The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative) |
| limitSqrtPrice | uint160 | The Q64.96 sqrt price limit. If zero for one, the price cannot be less than this value after the swap. If one for zero, the price cannot be greater than this value after the swap |
| amount0 | int256 | The delta of the balance of token0 of the pool, exact when negative, minimum when positive |
| amount1 | int256 | The delta of the balance of token1 of the pool, exact when negative, minimum when positive |
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

