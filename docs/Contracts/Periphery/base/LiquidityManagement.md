

# LiquidityManagement


Liquidity management functions

Internal functions for safely managing liquidity in Algebra

*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-periphery*

**Inherits:** [IAlgebraMintCallback](../../Core/interfaces/callback/IAlgebraMintCallback.md) [PeripheryImmutableState](PeripheryImmutableState.md) [PeripheryPayments](PeripheryPayments.md)

## Structs
### MintCallbackData



```solidity
struct MintCallbackData {
  struct PoolAddress.PoolKey poolKey;
  address payer;
}
```

### AddLiquidityParams



```solidity
struct AddLiquidityParams {
  address token0;
  address token1;
  address recipient;
  int24 tickLower;
  int24 tickUpper;
  uint256 amount0Desired;
  uint256 amount1Desired;
  uint256 amount0Min;
  uint256 amount1Min;
}
```


## Functions
### algebraMintCallback

```solidity
function algebraMintCallback(uint256 amount0Owed, uint256 amount1Owed, bytes data) external
```
**Selector**: `0x3dd657c5`

Called to &#x60;msg.sender&#x60; after minting liquidity to a position from [IAlgebraPool#mint](../../Core/interfaces/IAlgebraPool.md#mint).

*Developer note: In the implementation you must pay the pool tokens owed for the minted liquidity.
The caller of this method _must_ be checked to be a AlgebraPool deployed by the canonical AlgebraFactory.*

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0Owed | uint256 | The amount of token0 due to the pool for the minted liquidity |
| amount1Owed | uint256 | The amount of token1 due to the pool for the minted liquidity |
| data | bytes | Any data passed through by the caller via the [IAlgebraPoolActions#mint](../../Core/interfaces/pool/IAlgebraPoolActions.md#mint) call |

