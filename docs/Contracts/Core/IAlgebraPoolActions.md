

# IAlgebraPoolActions


Permissionless pool actions



*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces*




## Functions
### initialize


`function initialize(uint160 price) external`  external

Sets the initial price for the pool
*Developer note: Price is represented as a sqrt(amountToken1/amountToken0) Q64.96 value
Initialization should be done in one transaction with pool creation to avoid front-running*



| Name | Type | Description |
| ---- | ---- | ----------- |
| price | uint160 | the initial sqrt price of the pool as a Q64.96 |


### mint


`function mint(address sender, address recipient, int24 bottomTick, int24 topTick, uint128 amount, bytes data) external returns (uint256 amount0, uint256 amount1, uint128 liquidityActual)`  external

Adds liquidity for the given recipient/bottomTick/topTick position
*Developer note: The caller of this method receives a callback in the form of IAlgebraMintCallback# AlgebraMintCallback
in which they must pay any token0 or token1 owed for the liquidity. The amount of token0/token1 due depends
on bottomTick, topTick, the amount of liquidity, and the current price. If bottomTick &#x3D;&#x3D; topTick position is treated as a limit order*



| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The address which will receive potential surplus of paid tokens |
| recipient | address | The address for which the liquidity will be created |
| bottomTick | int24 | The lower tick of the position in which to add liquidity |
| topTick | int24 | The upper tick of the position in which to add liquidity |
| amount | uint128 | The desired amount of liquidity to mint |
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
*Developer note: The caller of this method receives a callback in the form of IAlgebraSwapCallback#AlgebraSwapCallback*



| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | The address to receive the output of the swap |
| zeroToOne | bool | The direction of the swap, true for token0 to token1, false for token1 to token0 |
| amountRequired | int256 | The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative) |
| limitSqrtPrice | uint160 | The Q64.96 sqrt price limit. If zero for one, the price cannot be less than this value after the swap. If one for zero, the price cannot be greater than this value after the swap |
| data | bytes | Any data to be passed through to the callback. If using the Router it should contain SwapRouter#SwapCallbackData |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | int256 | The delta of the balance of token0 of the pool, exact when negative, minimum when positive |
| amount1 | int256 | The delta of the balance of token1 of the pool, exact when negative, minimum when positive |

### swapSupportingFeeOnInputTokens


`function swapSupportingFeeOnInputTokens(address sender, address recipient, bool zeroToOne, int256 amountRequired, uint160 limitSqrtPrice, bytes data) external returns (int256 amount0, int256 amount1)`  external

Swap token0 for token1, or token1 for token0 (tokens that have fee on transfer)
*Developer note: The caller of this method receives a callback in the form of IAlgebraSwapCallback#AlgebraSwapCallback*



| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The address called this function (Comes from the Router) |
| recipient | address | The address to receive the output of the swap |
| zeroToOne | bool | The direction of the swap, true for token0 to token1, false for token1 to token0 |
| amountRequired | int256 | The amount of the swap, which implicitly configures the swap as exact input |
| limitSqrtPrice | uint160 | The Q64.96 sqrt price limit. If zero for one, the price cannot be less than this value after the swap. If one for zero, the price cannot be greater than this value after the swap |
| data | bytes | Any data to be passed through to the callback. If using the Router it should contain SwapRouter#SwapCallbackData |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | int256 | The delta of the balance of token0 of the pool, exact when negative, minimum when positive |
| amount1 | int256 | The delta of the balance of token1 of the pool, exact when negative, minimum when positive |

### flash


`function flash(address recipient, uint256 amount0, uint256 amount1, bytes data) external`  external

Receive token0 and/or token1 and pay it back, plus a fee, in the callback
*Developer note: The caller of this method receives a callback in the form of IAlgebraFlashCallback#AlgebraFlashCallback
All excess tokens paid in the callback are distributed to currently in-range liquidity providers as an additional fee.
If there are no in-range liquidity providers, the fee will be transferred to the first active provider in the future*



| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | The address which will receive the token0 and token1 amounts |
| amount0 | uint256 | The amount of token0 to send |
| amount1 | uint256 | The amount of token1 to send |
| data | bytes | Any data to be passed through to the callback |






---

