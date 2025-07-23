

# IAlgebraPoolImmutables


Pool state that never changes



*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces*


## Functions
### factory

```solidity
function factory() external view returns (address)
```
**Selector**: `0xc45a0155`

The Algebra factory contract, which must adhere to the IAlgebraFactory interface

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The contract address |

### token0

```solidity
function token0() external view returns (address)
```
**Selector**: `0x0dfe1681`

The first of the two tokens of the pool, sorted by address

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The token contract address |

### token1

```solidity
function token1() external view returns (address)
```
**Selector**: `0xd21220a7`

The second of the two tokens of the pool, sorted by address

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The token contract address |

### maxLiquidityPerTick

```solidity
function maxLiquidityPerTick() external view returns (uint128)
```
**Selector**: `0x70cf754a`

The maximum amount of position liquidity that can use any tick in the range

*Developer note: This parameter is enforced per tick to prevent liquidity from overflowing a uint128 at any point, and
also prevents out-of-range liquidity from being used to prevent adding in-range liquidity to a pool*

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 | The max amount of liquidity per tick |

