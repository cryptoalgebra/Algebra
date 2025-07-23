

# IAlgebraCustomPoolEntryPoint


An interface for a contract that is used to deploy and manage Algebra Integral custom pools



*Developer note: This contract should be called by every custom pool deployer to create new custom pools or manage existing ones.*

**Inherits:** [IAlgebraPluginFactory](../../Core/interfaces/plugin/IAlgebraPluginFactory.md)

## Functions
### factory

```solidity
function factory() external view returns (address factory)
```
**Selector**: `0xc45a0155`

Returns the address of corresponding AlgebraFactory contract

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| factory | address | The address of AlgebraFactory |

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

