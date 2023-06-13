

# ERC20










## Functions
### constructor


`constructor(string name_, string symbol_) public`  public


*Developer note: Sets the values for {name} and {symbol}, initializes {decimals} with
a default value of 18.

To select a different value for {decimals}, use {_setupDecimals}.

All three of these values are immutable: they can only be set once during
construction.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| name_ | string |  |
| symbol_ | string |  |


### name


`function name() public view virtual returns (string)` view public


*Developer note: Returns the name of the token.*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string |  |

### symbol


`function symbol() public view virtual returns (string)` view public


*Developer note: Returns the symbol of the token, usually a shorter version of the
name.*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string |  |

### decimals


`function decimals() public view virtual returns (uint8)` view public


*Developer note: Returns the number of decimals used to get its user representation.
For example, if &#x60;decimals&#x60; equals &#x60;2&#x60;, a balance of &#x60;505&#x60; tokens should
be displayed to a user as &#x60;5,05&#x60; (&#x60;505 / 10 ** 2&#x60;).

Tokens usually opt for a value of 18, imitating the relationship between
Ether and Wei. This is the value {ERC20} uses, unless {_setupDecimals} is
called.

NOTE: This information is only used for _display_ purposes: it in
no way affects any of the arithmetic of the contract, including
{IERC20-balanceOf} and {IERC20-transfer}.*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint8 |  |

### totalSupply


`function totalSupply() public view virtual returns (uint256)` view public


*Developer note: See {IERC20-totalSupply}.*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### balanceOf


`function balanceOf(address account) public view virtual returns (uint256)` view public


*Developer note: See {IERC20-balanceOf}.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### transfer


`function transfer(address recipient, uint256 amount) public virtual returns (bool)`  public


*Developer note: See {IERC20-transfer}.

Requirements:

- &#x60;recipient&#x60; cannot be the zero address.
- the caller must have a balance of at least &#x60;amount&#x60;.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address |  |
| amount | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

### allowance


`function allowance(address owner, address spender) public view virtual returns (uint256)` view public


*Developer note: See {IERC20-allowance}.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| spender | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### approve


`function approve(address spender, uint256 amount) public virtual returns (bool)`  public


*Developer note: See {IERC20-approve}.

Requirements:

- &#x60;spender&#x60; cannot be the zero address.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address |  |
| amount | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

### transferFrom


`function transferFrom(address sender, address recipient, uint256 amount) public virtual returns (bool)`  public


*Developer note: See {IERC20-transferFrom}.

Emits an {Approval} event indicating the updated allowance. This is not
required by the EIP. See the note at the beginning of {ERC20}.

Requirements:

- &#x60;sender&#x60; and &#x60;recipient&#x60; cannot be the zero address.
- &#x60;sender&#x60; must have a balance of at least &#x60;amount&#x60;.
- the caller must have allowance for &#x60;&#x60;sender&#x60;&#x60;&#x27;s tokens of at least
&#x60;amount&#x60;.*



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


`function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool)`  public


*Developer note: Atomically increases the allowance granted to &#x60;spender&#x60; by the caller.

This is an alternative to {approve} that can be used as a mitigation for
problems described in {IERC20-approve}.

Emits an {Approval} event indicating the updated allowance.

Requirements:

- &#x60;spender&#x60; cannot be the zero address.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address |  |
| addedValue | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

### decreaseAllowance


`function decreaseAllowance(address spender, uint256 subtractedValue) public virtual returns (bool)`  public


*Developer note: Atomically decreases the allowance granted to &#x60;spender&#x60; by the caller.

This is an alternative to {approve} that can be used as a mitigation for
problems described in {IERC20-approve}.

Emits an {Approval} event indicating the updated allowance.

Requirements:

- &#x60;spender&#x60; cannot be the zero address.
- &#x60;spender&#x60; must have allowance for the caller of at least
&#x60;subtractedValue&#x60;.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address |  |
| subtractedValue | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |




