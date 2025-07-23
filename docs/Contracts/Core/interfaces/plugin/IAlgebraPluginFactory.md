

# IAlgebraPluginFactory


An interface for a contract that is capable of deploying Algebra plugins



*Developer note: Such a factory can be used for automatic plugin creation for new pools.
Also a factory be used as an entry point for custom (additional) pools creation*


## Functions
### beforeCreatePoolHook

```solidity
function beforeCreatePoolHook(address pool, address creator, address deployer, address token0, address token1, bytes data) external returns (address)
```
**Selector**: `0x1d0338d9`

Deploys new plugin contract for pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The address of the new pool |
| creator | address | The address that initiated the pool creation |
| deployer | address | The address of new plugin deployer contract (0 if not used) |
| token0 | address | First token of the pool |
| token1 | address | Second token of the pool |
| data | bytes |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | New plugin address |

### afterCreatePoolHook

```solidity
function afterCreatePoolHook(address plugin, address pool, address deployer) external
```
**Selector**: `0x8d5ef8d1`

Called after the pool is created

| Name | Type | Description |
| ---- | ---- | ----------- |
| plugin | address | The plugin address |
| pool | address | The address of the new pool |
| deployer | address | The address of new plugin deployer contract (0 if not used) |

