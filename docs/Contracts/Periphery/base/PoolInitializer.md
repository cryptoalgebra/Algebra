

# PoolInitializer


Creates and initializes Algebra Pools



*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-periphery*

**Inherits:** [IPoolInitializer](../interfaces/IPoolInitializer.md) [PeripheryImmutableState](PeripheryImmutableState.md)

## Functions
### createAndInitializePoolIfNecessary

```solidity
function createAndInitializePoolIfNecessary(address token0, address token1, uint160 sqrtPriceX96) external payable returns (address pool)
```
**Selector**: `0x51246d6e`

Creates a new pool if it does not exist, then initializes if not initialized

*Developer note: This method can be bundled with others via IMulticall for the first action (e.g. mint) performed against a pool*

| Name | Type | Description |
| ---- | ---- | ----------- |
| token0 | address | The contract address of token0 of the pool |
| token1 | address | The contract address of token1 of the pool |
| sqrtPriceX96 | uint160 | The initial square root price of the pool as a Q64.96 value |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | Returns the pool address based on the pair of tokens and fee, will return the newly created pool address if necessary |

