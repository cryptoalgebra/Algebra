

# IAlgebraPoolEvents


Events emitted by a pool



*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces*


## Events
### Initialize

```solidity
event Initialize(uint160 price, int24 tick)
```

Emitted exactly once by a pool when #initialize is first called on the pool

*Developer note: Mint/Burn/Swaps cannot be emitted by the pool before Initialize*

| Name | Type | Description |
| ---- | ---- | ----------- |
| price | uint160 | The initial sqrt price of the pool, as a Q64.96 |
| tick | int24 | The initial tick of the pool, i.e. log base 1.0001 of the starting price of the pool |

### Mint

```solidity
event Mint(address sender, address owner, int24 bottomTick, int24 topTick, uint128 liquidityAmount, uint256 amount0, uint256 amount1)
```

Emitted when liquidity is minted for a given position

| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The address that minted the liquidity |
| owner | address | The owner of the position and recipient of any minted liquidity |
| bottomTick | int24 | The lower tick of the position |
| topTick | int24 | The upper tick of the position |
| liquidityAmount | uint128 | The amount of liquidity minted to the position range |
| amount0 | uint256 | How much token0 was required for the minted liquidity |
| amount1 | uint256 | How much token1 was required for the minted liquidity |

### Collect

```solidity
event Collect(address owner, address recipient, int24 bottomTick, int24 topTick, uint128 amount0, uint128 amount1)
```

Emitted when fees are collected by the owner of a position

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The owner of the position for which fees are collected |
| recipient | address | The address that received fees |
| bottomTick | int24 | The lower tick of the position |
| topTick | int24 | The upper tick of the position |
| amount0 | uint128 | The amount of token0 fees collected |
| amount1 | uint128 | The amount of token1 fees collected |

### Burn

```solidity
event Burn(address owner, int24 bottomTick, int24 topTick, uint128 liquidityAmount, uint256 amount0, uint256 amount1)
```

Emitted when a position&#x27;s liquidity is removed

*Developer note: Does not withdraw any fees earned by the liquidity position, which must be withdrawn via #collect*

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The owner of the position for which liquidity is removed |
| bottomTick | int24 | The lower tick of the position |
| topTick | int24 | The upper tick of the position |
| liquidityAmount | uint128 | The amount of liquidity to remove |
| amount0 | uint256 | The amount of token0 withdrawn |
| amount1 | uint256 | The amount of token1 withdrawn |

### Swap

```solidity
event Swap(address sender, address recipient, int256 amount0, int256 amount1, uint160 price, uint128 liquidity, int24 tick)
```

Emitted by the pool for any swaps between token0 and token1

| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The address that initiated the swap call, and that received the callback |
| recipient | address | The address that received the output of the swap |
| amount0 | int256 | The delta of the token0 balance of the pool |
| amount1 | int256 | The delta of the token1 balance of the pool |
| price | uint160 | The sqrt(price) of the pool after the swap, as a Q64.96 |
| liquidity | uint128 | The liquidity of the pool after the swap |
| tick | int24 | The log base 1.0001 of price of the pool after the swap |

### Flash

```solidity
event Flash(address sender, address recipient, uint256 amount0, uint256 amount1, uint256 paid0, uint256 paid1)
```

Emitted by the pool for any flashes of token0/token1

| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The address that initiated the swap call, and that received the callback |
| recipient | address | The address that received the tokens from flash |
| amount0 | uint256 | The amount of token0 that was flashed |
| amount1 | uint256 | The amount of token1 that was flashed |
| paid0 | uint256 | The amount of token0 paid for the flash, which can exceed the amount0 plus the fee |
| paid1 | uint256 | The amount of token1 paid for the flash, which can exceed the amount1 plus the fee |

### CommunityFee

```solidity
event CommunityFee(uint16 communityFeeNew)
```

Emitted when the community fee is changed by the pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| communityFeeNew | uint16 | The updated value of the community fee in thousandths (1e-3) |

### TickSpacing

```solidity
event TickSpacing(int24 newTickSpacing)
```

Emitted when the tick spacing changes

| Name | Type | Description |
| ---- | ---- | ----------- |
| newTickSpacing | int24 | The updated value of the new tick spacing |

### Plugin

```solidity
event Plugin(address newPluginAddress)
```

Emitted when the plugin address changes

| Name | Type | Description |
| ---- | ---- | ----------- |
| newPluginAddress | address | New plugin address |

### PluginConfig

```solidity
event PluginConfig(uint8 newPluginConfig)
```

Emitted when the plugin config changes

| Name | Type | Description |
| ---- | ---- | ----------- |
| newPluginConfig | uint8 | New plugin config |

### Fee

```solidity
event Fee(uint16 fee)
```

Emitted when the fee changes inside the pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| fee | uint16 | The current fee in hundredths of a bip, i.e. 1e-6 |

