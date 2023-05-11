

# IV3Migrator


Algebra Migrator
Enables migration of liquidity from Uniswap v2-compatible pairs into Algebra pools
*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-periphery*




## Functions
### migrate


`function migrate(struct IV3Migrator.MigrateParams params) external`  external

Migrates liquidity to Algebra by burning v2 liquidity and minting a new position for Algebra
*Developer note: Slippage protection is enforced via &#x60;amount{0,1}Min&#x60;, which should be a discount of the expected values of
the maximum amount of Algebra liquidity that the v2 liquidity can get. For the special case of migrating to an
out-of-range position, &#x60;amount{0,1}Min&#x60; may be set to 0, enforcing that the position remains out of range*



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct IV3Migrator.MigrateParams | The params necessary to migrate v2 liquidity, encoded as &#x60;MigrateParams&#x60; in calldata |






---

