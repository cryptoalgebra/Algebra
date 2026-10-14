

# IAlgebraPoolPermissionedActions


Permissioned pool actions

Contains pool methods that may only be called by permissioned addresses

*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces*


## Functions
### setCommunityFee

```solidity
function setCommunityFee(uint16 newCommunityFee) external
```
**Selector**: `0x240a875a`

Set the community&#x27;s % share of the fees. Only factory owner or POOLS_ADMINISTRATOR_ROLE role

| Name | Type | Description |
| ---- | ---- | ----------- |
| newCommunityFee | uint16 | The new community fee percent in thousandths (1e-3) |

### setFeeMode

```solidity
function setFeeMode(uint8 newFeeMode) external
```
**Selector**: `0x5e6f1cb8`

Set the token in which the swap fee is collected. Only factory owner or POOLS_ADMINISTRATOR_ROLE role

*Developer note: The fee growth already accrued in the other token is not migrated, positions can still collect it*

| Name | Type | Description |
| ---- | ---- | ----------- |
| newFeeMode | uint8 | The new fee mode: 0 - the input token of each swap, 1 - always token0, 2 - always token1 |

### setTickSpacing

```solidity
function setTickSpacing(int24 newTickSpacing) external
```
**Selector**: `0xf085a610`

Set the new tick spacing values. Only factory owner or POOLS_ADMINISTRATOR_ROLE role

| Name | Type | Description |
| ---- | ---- | ----------- |
| newTickSpacing | int24 | The new tick spacing value |

### setPlugin

```solidity
function setPlugin(address newPluginAddress) external
```
**Selector**: `0xcc1f97cf`

Set the new plugin address. Only factory owner or POOLS_ADMINISTRATOR_ROLE role

| Name | Type | Description |
| ---- | ---- | ----------- |
| newPluginAddress | address | The new plugin address |

### setPluginConfig

```solidity
function setPluginConfig(uint16 newConfig) external
```
**Selector**: `0x54884e9d`

Set new plugin config. Only factory owner or POOLS_ADMINISTRATOR_ROLE role

| Name | Type | Description |
| ---- | ---- | ----------- |
| newConfig | uint16 | In the new configuration of the plugin, each bit of which is responsible for a particular hook. |

### setCommunityVault

```solidity
function setCommunityVault(address newCommunityVault) external
```
**Selector**: `0xd8544cf3`

Set new community fee vault address. Only factory owner or POOLS_ADMINISTRATOR_ROLE role

*Developer note: Community fee vault receives collected community fees.
**accumulated but not yet sent to the vault community fees once will be sent to the &#x60;newCommunityVault&#x60; address***

| Name | Type | Description |
| ---- | ---- | ----------- |
| newCommunityVault | address | The address of new community fee vault |

### setFee

```solidity
function setFee(uint16 newFee) external
```
**Selector**: `0x8e005553`

Set new pool fee. Can be called by owner if dynamic fee is disabled.
Called by the plugin if dynamic fee is enabled

| Name | Type | Description |
| ---- | ---- | ----------- |
| newFee | uint16 | The new fee value |

### sync

```solidity
function sync() external
```
**Selector**: `0xfff6cae9`

Forces balances to match reserves. Excessive tokens will be distributed between active LPs

*Developer note: Only plugin can call this function*

### skim

```solidity
function skim() external
```
**Selector**: `0x1dd19cb4`

Forces balances to match reserves. Excessive tokens will be sent to msg.sender

*Developer note: Only plugin can call this function*

### claimCommunityFee

```solidity
function claimCommunityFee() external returns (uint128 amount0, uint128 amount1)
```
**Selector**: `0x5dddf3e6`

Sends the accumulated community fees to the community vault

*Developer note: Only the community vault can call this function*

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint128 | The amount of token0 sent |
| amount1 | uint128 | The amount of token1 sent |

