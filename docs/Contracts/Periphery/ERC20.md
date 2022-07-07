

# ERC20



*Developer note: Implementation of the {IERC20} interface.
This implementation is agnostic to the way tokens are created. This means
that a supply mechanism has to be added in a derived contract using {_mint}.
For a generic mechanism see {ERC20PresetMinterPauser}.
TIP: For a detailed writeup see our guide
https://forum.zeppelin.solutions/t/how-to-implement-erc20-supply-mechanisms/226[How
to implement supply mechanisms].
We have followed general OpenZeppelin guidelines: functions revert instead
of returning &#x60;false&#x60; on failure. This behavior is nonetheless conventional
and does not conflict with the expectations of ERC20 applications.
Additionally, an {Approval} event is emitted on calls to {transferFrom}.
This allows applications to reconstruct the allowance for all accounts just
by listening to said events. Other implementations of the EIP may not emit
these events, as it isn&#x27;t required by the specification.
Finally, the non-standard {decreaseAllowance} and {increaseAllowance}
functions have been added to mitigate the well-known issues around setting
allowances. See {IERC20-approve}.*




## Functions
### constructor


`constructor(string,string)`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| name_ | string |  |
| symbol_ | string |  |


### name


`name()` view public






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string |  |

### symbol


`symbol()` view public






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string |  |

### decimals


`decimals()` view public






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint8 |  |

### totalSupply


`totalSupply()` view public






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### balanceOf


`balanceOf(address)` view public





| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### transfer


`transfer(address,uint256)`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address |  |
| amount | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

### allowance


`allowance(address,address)` view public





| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| spender | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### approve


`approve(address,uint256)`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address |  |
| amount | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

### transferFrom


`transferFrom(address,address,uint256)`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address |  |
| recipient | address |  |
| amount | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

### increaseAllowance


`increaseAllowance(address,uint256)`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address |  |
| addedValue | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

### decreaseAllowance


`decreaseAllowance(address,uint256)`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address |  |
| subtractedValue | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |



---


