

# IAlgebraPoolActions







## Functions
### initialize


`initialize(uint160)`  external

Sets the initial price for the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| price | uint160 | the initial sqrt price of the pool as a Q64.96 |


### mint


`mint(address,address,int24,int24,uint128,bytes)`  external

Adds liquidity for the given recipient/bottomTick/topTick position



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
| amount0 | uint256 |  |
| amount1 | uint256 |  |
| liquidityActual | uint128 |  |

### collect


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
| amountSpecified | int256 | The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative) |
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
| amountSpecified | int256 | The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative) |
| limitSqrtPrice | uint160 | The Q64.96 sqrt price limit. If zero for one, the price cannot be less than this value after the swap. If one for zero, the price cannot be greater than this value after the swap |
| data | bytes | Any data to be passed through to the callback. If using the Router it should contain SwapRouter#SwapCallbackData |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | int256 |  |
| amount1 | int256 |  |

### flash


`flash(address,uint256,uint256,bytes)`  external

Receive token0 and/or token1 and pay it back, plus a fee, in the callback



| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | The address which will receive the token0 and token1 amounts |
| amount0 | uint256 | The amount of token0 to send |
| amount1 | uint256 | The amount of token1 to send |
| data | bytes | Any data to be passed through to the callback |




---




# IAlgebraPoolActions







## Functions
### initialize


`initialize(uint160)`  external

Sets the initial price for the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| price | uint160 | the initial sqrt price of the pool as a Q64.96 |


### mint


`mint(address,address,int24,int24,uint128,bytes)`  external

Adds liquidity for the given recipient/bottomTick/topTick position



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
| amount0 | uint256 |  |
| amount1 | uint256 |  |
| liquidityActual | uint128 |  |

### collect


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
| amountSpecified | int256 | The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative) |
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
| amountSpecified | int256 | The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative) |
| limitSqrtPrice | uint160 | The Q64.96 sqrt price limit. If zero for one, the price cannot be less than this value after the swap. If one for zero, the price cannot be greater than this value after the swap |
| data | bytes | Any data to be passed through to the callback. If using the Router it should contain SwapRouter#SwapCallbackData |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | int256 |  |
| amount1 | int256 |  |

### flash


`flash(address,uint256,uint256,bytes)`  external

Receive token0 and/or token1 and pay it back, plus a fee, in the callback



| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | The address which will receive the token0 and token1 amounts |
| amount0 | uint256 | The amount of token0 to send |
| amount1 | uint256 | The amount of token1 to send |
| data | bytes | Any data to be passed through to the callback |




---




# IAlgebraPoolActions







## Functions
### initialize


`initialize(uint160)`  external

Sets the initial price for the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| price | uint160 | the initial sqrt price of the pool as a Q64.96 |


### mint


`mint(address,address,int24,int24,uint128,bytes)`  external

Adds liquidity for the given recipient/bottomTick/topTick position



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
| amount0 | uint256 |  |
| amount1 | uint256 |  |
| liquidityActual | uint128 |  |

### collect


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
| amountSpecified | int256 | The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative) |
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
| amountSpecified | int256 | The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative) |
| limitSqrtPrice | uint160 | The Q64.96 sqrt price limit. If zero for one, the price cannot be less than this value after the swap. If one for zero, the price cannot be greater than this value after the swap |
| data | bytes | Any data to be passed through to the callback. If using the Router it should contain SwapRouter#SwapCallbackData |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | int256 |  |
| amount1 | int256 |  |

### flash


`flash(address,uint256,uint256,bytes)`  external

Receive token0 and/or token1 and pay it back, plus a fee, in the callback



| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | The address which will receive the token0 and token1 amounts |
| amount0 | uint256 | The amount of token0 to send |
| amount1 | uint256 | The amount of token1 to send |
| data | bytes | Any data to be passed through to the callback |




---




# IAlgebraPoolActions







## Functions
### initialize


`initialize(uint160)`  external

Sets the initial price for the pool



| Name | Type | Description |
| ---- | ---- | ----------- |
| price | uint160 | the initial sqrt price of the pool as a Q64.96 |


### mint


`mint(address,address,int24,int24,uint128,bytes)`  external

Adds liquidity for the given recipient/bottomTick/topTick position



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
| amount0 | uint256 |  |
| amount1 | uint256 |  |
| liquidityActual | uint128 |  |

### collect


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
| amountSpecified | int256 | The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative) |
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
| amountSpecified | int256 | The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative) |
| limitSqrtPrice | uint160 | The Q64.96 sqrt price limit. If zero for one, the price cannot be less than this value after the swap. If one for zero, the price cannot be greater than this value after the swap |
| data | bytes | Any data to be passed through to the callback. If using the Router it should contain SwapRouter#SwapCallbackData |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | int256 |  |
| amount1 | int256 |  |

### flash


`flash(address,uint256,uint256,bytes)`  external

Receive token0 and/or token1 and pay it back, plus a fee, in the callback



| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | The address which will receive the token0 and token1 amounts |
| amount0 | uint256 | The amount of token0 to send |
| amount1 | uint256 | The amount of token1 to send |
| data | bytes | Any data to be passed through to the callback |




---


