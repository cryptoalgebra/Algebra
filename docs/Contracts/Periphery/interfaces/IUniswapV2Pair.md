

# IUniswapV2Pair







## Events
### Approval

```solidity
event Approval(address owner, address spender, uint256 value)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| spender | address |  |
| value | uint256 |  |

### Transfer

```solidity
event Transfer(address from, address to, uint256 value)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address |  |
| to | address |  |
| value | uint256 |  |

### Mint

```solidity
event Mint(address sender, uint256 amount0, uint256 amount1)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address |  |
| amount0 | uint256 |  |
| amount1 | uint256 |  |

### Burn

```solidity
event Burn(address sender, uint256 amount0, uint256 amount1, address to)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address |  |
| amount0 | uint256 |  |
| amount1 | uint256 |  |
| to | address |  |

### Swap

```solidity
event Swap(address sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address to)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address |  |
| amount0In | uint256 |  |
| amount1In | uint256 |  |
| amount0Out | uint256 |  |
| amount1Out | uint256 |  |
| to | address |  |

### Sync

```solidity
event Sync(uint112 reserve0, uint112 reserve1)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| reserve0 | uint112 |  |
| reserve1 | uint112 |  |


## Functions
### name

```solidity
function name() external pure returns (string)
```
**Selector**: `0x06fdde03`



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string |  |

### symbol

```solidity
function symbol() external pure returns (string)
```
**Selector**: `0x95d89b41`



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string |  |

### decimals

```solidity
function decimals() external pure returns (uint8)
```
**Selector**: `0x313ce567`



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint8 |  |

### totalSupply

```solidity
function totalSupply() external view returns (uint256)
```
**Selector**: `0x18160ddd`



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### balanceOf

```solidity
function balanceOf(address owner) external view returns (uint256)
```
**Selector**: `0x70a08231`



| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### allowance

```solidity
function allowance(address owner, address spender) external view returns (uint256)
```
**Selector**: `0xdd62ed3e`



| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| spender | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### approve

```solidity
function approve(address spender, uint256 value) external returns (bool)
```
**Selector**: `0x095ea7b3`



| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address |  |
| value | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

### transfer

```solidity
function transfer(address to, uint256 value) external returns (bool)
```
**Selector**: `0xa9059cbb`



| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address |  |
| value | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

### transferFrom

```solidity
function transferFrom(address from, address to, uint256 value) external returns (bool)
```
**Selector**: `0x23b872dd`



| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address |  |
| to | address |  |
| value | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

### DOMAIN_SEPARATOR

```solidity
function DOMAIN_SEPARATOR() external view returns (bytes32)
```
**Selector**: `0x3644e515`



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32 |  |

### PERMIT_TYPEHASH

```solidity
function PERMIT_TYPEHASH() external pure returns (bytes32)
```
**Selector**: `0x30adf81f`



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32 |  |

### nonces

```solidity
function nonces(address owner) external view returns (uint256)
```
**Selector**: `0x7ecebe00`



| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### permit

```solidity
function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external
```
**Selector**: `0xd505accf`



| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| spender | address |  |
| value | uint256 |  |
| deadline | uint256 |  |
| v | uint8 |  |
| r | bytes32 |  |
| s | bytes32 |  |

### MINIMUM_LIQUIDITY

```solidity
function MINIMUM_LIQUIDITY() external pure returns (uint256)
```
**Selector**: `0xba9a7a56`



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### factory

```solidity
function factory() external view returns (address)
```
**Selector**: `0xc45a0155`



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

### token0

```solidity
function token0() external view returns (address)
```
**Selector**: `0x0dfe1681`



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

### token1

```solidity
function token1() external view returns (address)
```
**Selector**: `0xd21220a7`



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

### getReserves

```solidity
function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)
```
**Selector**: `0x0902f1ac`



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reserve0 | uint112 |  |
| reserve1 | uint112 |  |
| blockTimestampLast | uint32 |  |

### price0CumulativeLast

```solidity
function price0CumulativeLast() external view returns (uint256)
```
**Selector**: `0x5909c0d5`



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### price1CumulativeLast

```solidity
function price1CumulativeLast() external view returns (uint256)
```
**Selector**: `0x5a3d5493`



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### kLast

```solidity
function kLast() external view returns (uint256)
```
**Selector**: `0x7464fc3d`



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### mint

```solidity
function mint(address to) external returns (uint256 liquidity)
```
**Selector**: `0x6a627842`



| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidity | uint256 |  |

### burn

```solidity
function burn(address to) external returns (uint256 amount0, uint256 amount1)
```
**Selector**: `0x89afcb44`



| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint256 |  |
| amount1 | uint256 |  |

### swap

```solidity
function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes data) external
```
**Selector**: `0x022c0d9f`



| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0Out | uint256 |  |
| amount1Out | uint256 |  |
| to | address |  |
| data | bytes |  |

### skim

```solidity
function skim(address to) external
```
**Selector**: `0xbc25cf77`



| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address |  |

### sync

```solidity
function sync() external
```
**Selector**: `0xfff6cae9`



### initialize

```solidity
function initialize(address, address) external
```
**Selector**: `0x485cc955`



| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |
|  | address |  |

