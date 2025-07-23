

# AlgebraCustomPoolEntryPoint


Algebra custom pool entry point

Is used to create custom pools

*Developer note: Version: Algebra Integral 1.2.2*

**Inherits:** [IAlgebraCustomPoolEntryPoint](interfaces/IAlgebraCustomPoolEntryPoint.md)
## Modifiers
### onlyCustomDeployer

```solidity
modifier onlyCustomDeployer(address pool)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address |  |


## Public variables
### factory
```solidity
address immutable factory
```
**Selector**: `0xc45a0155`

Returns the address of corresponding AlgebraFactory contract



## Functions
### constructor

```solidity
constructor(address _factory) public
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| _factory | address |  |

### createCustomPool

```solidity
function createCustomPool(address deployer, address creator, address tokenA, address tokenB, bytes data) external returns (address customPool)
```
**Selector**: `0xdbbf3db4`

Using for custom pools creation

| Name | Type | Description |
| ---- | ---- | ----------- |
| deployer | address | The address of plugin deployer, also used for custom pool address calculation |
| creator | address | The initiator of custom pool creation |
| tokenA | address | One of the two tokens in the desired pool |
| tokenB | address | The other of the two tokens in the desired pool |
| data | bytes | The additional data bytes |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| customPool | address |  |

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

### setTickSpacing

```solidity
function setTickSpacing(address pool, int24 newTickSpacing) external
```
**Selector**: `0x4bf092cd`

Changes the tick spacing value in the Algebra Integral custom pool

*Developer note: Only corresponding custom pool deployer contract can call this function*

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The address of the Algebra Integral custom pool |
| newTickSpacing | int24 | The new tick spacing value |

### setPlugin

```solidity
function setPlugin(address pool, address newPluginAddress) external
```
**Selector**: `0xf9f4c09a`

Changes the plugin address in the Algebra Integral custom pool

*Developer note: Only corresponding custom pool deployer contract can call this function*

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The address of the Algebra Integral custom pool |
| newPluginAddress | address | The new plugin address |

### setPluginConfig

```solidity
function setPluginConfig(address pool, uint8 newConfig) external
```
**Selector**: `0x054bee3d`

Changes the plugin configuration in the Algebra Integral custom pool

*Developer note: Only corresponding custom pool deployer contract can call this function*

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The address of the Algebra Integral custom pool |
| newConfig | uint8 | The new plugin configuration bitmap |

### setFee

```solidity
function setFee(address pool, uint16 newFee) external
```
**Selector**: `0x337f3a31`

Changes the fee value in the Algebra Integral custom pool

*Developer note: Only corresponding custom pool deployer contract can call this function.
Fee can be changed manually only if pool does not have &quot;dynamic fee&quot; configuration*

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The address of the Algebra Integral custom pool |
| newFee | uint16 | The new fee value |

