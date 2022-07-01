

# IUniswapV2Pair





## Events
### Approval


`Approval(address,address,uint256)`  





| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| spender | address |  |
| value | uint256 |  |


### Transfer


`Transfer(address,address,uint256)`  





| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address |  |
| to | address |  |
| value | uint256 |  |


### Mint


`Mint(address,uint256,uint256)`  





| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address |  |
| amount0 | uint256 |  |
| amount1 | uint256 |  |


### Burn


`Burn(address,uint256,uint256,address)`  





| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address |  |
| amount0 | uint256 |  |
| amount1 | uint256 |  |
| to | address |  |


### Swap


`Swap(address,uint256,uint256,uint256,uint256,address)`  





| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address |  |
| amount0In | uint256 |  |
| amount1In | uint256 |  |
| amount0Out | uint256 |  |
| amount1Out | uint256 |  |
| to | address |  |


### Sync


`Sync(uint112,uint112)`  





| Name | Type | Description |
| ---- | ---- | ----------- |
| reserve0 | uint112 |  |
| reserve1 | uint112 |  |




## Functions
### name


`name()` pure external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string |  |

### symbol


`symbol()` pure external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string |  |

### decimals


`decimals()` pure external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint8 |  |

### totalSupply


`totalSupply()` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### balanceOf


`balanceOf(address)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### allowance


`allowance(address,address)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| spender | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### approve


`approve(address,uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address |  |
| value | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

### transfer


`transfer(address,uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address |  |
| value | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

### transferFrom


`transferFrom(address,address,uint256)`  external





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


`DOMAIN_SEPARATOR()` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32 |  |

### PERMIT_TYPEHASH


`PERMIT_TYPEHASH()` pure external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32 |  |

### nonces


`nonces(address)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### permit


`permit(address,address,uint256,uint256,uint8,bytes32,bytes32)`  external





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


`MINIMUM_LIQUIDITY()` pure external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### factory


`factory()` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

### token0


`token0()` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

### token1


`token1()` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

### getReserves


`getReserves()` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| reserve0 | uint112 |  |
| reserve1 | uint112 |  |
| blockTimestampLast | uint32 |  |

### price0CumulativeLast


`price0CumulativeLast()` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### price1CumulativeLast


`price1CumulativeLast()` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### kLast


`kLast()` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### mint


`mint(address)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| liquidity | uint256 |  |

### burn


`burn(address)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0 | uint256 |  |
| amount1 | uint256 |  |

### swap


`swap(uint256,uint256,address,bytes)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| amount0Out | uint256 |  |
| amount1Out | uint256 |  |
| to | address |  |
| data | bytes |  |


### skim


`skim(address)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address |  |


### sync


`sync()`  external







### initialize


`initialize(address,address)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
|  | address |  |
|  | address |  |




---


