

# V3Migrator


Algebra Migrator



*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-periphery*

**Inherits:** [IV3Migrator](interfaces/IV3Migrator.md) [PeripheryImmutableState](base/PeripheryImmutableState.md) [PoolInitializer](base/PoolInitializer.md) [Multicall](base/Multicall.md) [SelfPermit](base/SelfPermit.md)

## Public variables
### nonfungiblePositionManager
```solidity
address immutable nonfungiblePositionManager
```
**Selector**: `0xb44a2722`





## Functions
### constructor

```solidity
constructor(address _factory, address _WNativeToken, address _nonfungiblePositionManager, address _poolDeployer) public
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| _factory | address |  |
| _WNativeToken | address |  |
| _nonfungiblePositionManager | address |  |
| _poolDeployer | address |  |

### receive

```solidity
receive() external payable
```



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

