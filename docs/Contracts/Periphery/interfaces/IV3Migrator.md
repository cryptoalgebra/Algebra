

# IV3Migrator


Algebra Migrator

Enables migration of liquidity from Uniswap v2-compatible pairs into Algebra pools

*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-periphery*

**Inherits:** [IMulticall](IMulticall.md) [ISelfPermit](ISelfPermit.md) [IPoolInitializer](IPoolInitializer.md)

## Structs
### MigrateParams



```solidity
struct MigrateParams {
  address pair;
  uint256 liquidityToMigrate;
  uint8 percentageToMigrate;
  address token0;
  address token1;
  int24 tickLower;
  int24 tickUpper;
  uint256 amount0Min;
  uint256 amount1Min;
  address recipient;
  uint256 deadline;
  bool refundAsNative;
}
```


## Functions
### migrate

```solidity
function migrate(struct IV3Migrator.MigrateParams params) external
```
**Selector**: `0x8be74fb6`

Migrates liquidity to Algebra by burning v2 liquidity and minting a new position for Algebra

*Developer note: Slippage protection is enforced via &#x60;amount{0,1}Min&#x60;, which should be a discount of the expected values of
the maximum amount of Algebra liquidity that the v2 liquidity can get. For the special case of migrating to an
out-of-range position, &#x60;amount{0,1}Min&#x60; may be set to 0, enforcing that the position remains out of range*

| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct IV3Migrator.MigrateParams | The params necessary to migrate v2 liquidity, encoded as `MigrateParams` in calldata |

