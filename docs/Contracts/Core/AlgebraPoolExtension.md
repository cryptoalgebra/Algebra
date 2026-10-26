

# AlgebraPoolExtension


Algebra pool extension

Contains pool initialization and permissioned setter logic, called via delegatecall from pool

*Developer note: The pool immutables except &#x60;factory&#x60; are zero here, see &#x60;_getDeployParameters&#x60;
Version: Algebra Integral 1.3*

**Inherits:** [AlgebraPoolBase](base/AlgebraPoolBase.md) ReentrancyGuard

## Functions
### initialize

```solidity
function initialize(uint160 initialPrice) external
```
**Selector**: `0xf637731d`

Sets the initial price for the pool

*Developer note: Price is represented as a sqrt(amountToken1/amountToken0) Q64.96 value
Initialization should be done in one transaction with pool creation to avoid front-running*

| Name | Type | Description |
| ---- | ---- | ----------- |
| initialPrice | uint160 | The initial sqrt price of the pool as a Q64.96 |

### mint

```solidity
function mint(address, address, int24, int24, uint128, bytes) external pure returns (uint256, uint256, uint128)
```
**Selector**: `0xaafe29c0`



| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |
|  | address |  |
|  | int24 |  |
|  | int24 |  |
|  | uint128 |  |
|  | bytes |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |
| [1] | uint256 |  |
| [2] | uint128 |  |

### burn

```solidity
function burn(int24, int24, uint128, bytes) external pure returns (uint256, uint256)
```
**Selector**: `0x3b3bc70e`



| Name | Type | Description |
| ---- | ---- | ----------- |
|  | int24 |  |
|  | int24 |  |
|  | uint128 |  |
|  | bytes |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |
| [1] | uint256 |  |

### collect

```solidity
function collect(address, int24, int24, uint128, uint128) external pure returns (uint128, uint128)
```
**Selector**: `0x4f1eb3d8`



| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |
|  | int24 |  |
|  | int24 |  |
|  | uint128 |  |
|  | uint128 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 |  |
| [1] | uint128 |  |

### swap

```solidity
function swap(address, bool, int256, uint160, bytes) external pure returns (int256, int256)
```
**Selector**: `0x128acb08`



| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |
|  | bool |  |
|  | int256 |  |
|  | uint160 |  |
|  | bytes |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | int256 |  |
| [1] | int256 |  |

### swapWithPaymentInAdvance

```solidity
function swapWithPaymentInAdvance(address, address, bool, int256, uint160, bytes) external pure returns (int256, int256)
```
**Selector**: `0x9e4e0227`



| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |
|  | address |  |
|  | bool |  |
|  | int256 |  |
|  | uint160 |  |
|  | bytes |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | int256 |  |
| [1] | int256 |  |

### flash

```solidity
function flash(address, uint256, uint256, bytes) external pure
```
**Selector**: `0x490e6cbc`



| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |
|  | uint256 |  |
|  | uint256 |  |
|  | bytes |  |

### sync

```solidity
function sync() external pure
```
**Selector**: `0xfff6cae9`

Forces balances to match reserves. Excessive tokens will be distributed between active LPs

*Developer note: Only plugin can call this function*

### skim

```solidity
function skim() external pure
```
**Selector**: `0x1dd19cb4`

Forces balances to match reserves. Excessive tokens will be sent to msg.sender

*Developer note: Only plugin can call this function*

### claimCommunityFee

```solidity
function claimCommunityFee() external pure returns (uint128, uint128)
```
**Selector**: `0x5dddf3e6`

Sends the accumulated community fees to the community vault

*Developer note: Only the community vault can call this function*

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 |  |
| [1] | uint128 |  |

### getReserves

```solidity
function getReserves() external pure returns (uint128, uint128)
```
**Selector**: `0x0902f1ac`

The tracked token0 and token1 reserves of pool

*Developer note: If at any time the real balance is larger, the excess will be transferred to liquidity providers as additional fee.
If the balance exceeds uint128, the excess will be sent to the communityVault.*

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint128 |  |
| [1] | uint128 |  |

### positions

```solidity
function positions(bytes32) external pure returns (uint256, uint256, uint256, uint128, uint128)
```
**Selector**: `0x514ea4bf`



| Name | Type | Description |
| ---- | ---- | ----------- |
|  | bytes32 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |
| [1] | uint256 |  |
| [2] | uint256 |  |
| [3] | uint128 |  |
| [4] | uint128 |  |

### tickTreeRoot

```solidity
function tickTreeRoot() external pure returns (uint32)
```
**Selector**: `0x578b9a36`

The root of tick search tree

*Developer note: Each bit corresponds to one node in the second layer of tick tree: &#x27;1&#x27; if node has at least one active bit.
**important security note: caller should check reentrancy lock to prevent read-only reentrancy***

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 | The root of tick search tree as bitmap |

### tickTreeSecondLayer

```solidity
function tickTreeSecondLayer(int16) external pure returns (uint256)
```
**Selector**: `0xd8619037`

The second layer of tick search tree

*Developer note: Each bit in node corresponds to one node in the leafs layer (&#x60;tickTable&#x60;) of tick tree: &#x27;1&#x27; if leaf has at least one active bit.
**important security note: caller should check reentrancy lock to prevent read-only reentrancy***

| Name | Type | Description |
| ---- | ---- | ----------- |
|  | int16 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The node of tick search tree second layer |

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

Set new plugin config. Only factory owner, POOLS_ADMINISTRATOR_ROLE role or the connected plugin

| Name | Type | Description |
| ---- | ---- | ----------- |
| newConfig | uint16 | In the new configuration of the plugin, each bit of which is responsible for a particular hook. |

### setCommunityVault

```solidity
function setCommunityVault(address newCommunityVault) external
```
**Selector**: `0xd8544cf3`

Set new community fee vault address. Only factory owner, POOLS_ADMINISTRATOR_ROLE role or the factory

*Developer note: The vault claims community fees with &#x60;claimCommunityFee&#x60;, unclaimed ones only by the &#x60;newCommunityVault&#x60;.
The zero address also sets the community fee to zero*

| Name | Type | Description |
| ---- | ---- | ----------- |
| newCommunityVault | address | The address of new community fee vault |

### setFee

```solidity
function setFee(uint16 newFee) external
```
**Selector**: `0x8e005553`

Set new pool fee if dynamic fee is disabled. Only factory owner or POOLS_ADMINISTRATOR_ROLE role

| Name | Type | Description |
| ---- | ---- | ----------- |
| newFee | uint16 | The new fee value |

