

# IERC20Minimal


Minimal ERC20 interface for Algebra

Contains a subset of the full ERC20 interface that is used in Algebra



## Events
### Transfer


`event Transfer(address from, address to, uint256 value)`  

Event emitted when tokens are transferred from one address to another, either via &#x60;#transfer&#x60; or &#x60;#transferFrom&#x60;.



| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | The account from which the tokens were sent, i.e. the balance decreased |
| to | address | The account to which the tokens were sent, i.e. the balance increased |
| value | uint256 | The amount of tokens that were transferred |


### Approval


`event Approval(address owner, address spender, uint256 value)`  

Event emitted when the approval amount for the spender of a given owner&#x27;s tokens changes.



| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The account that approved spending of its tokens |
| spender | address | The account for which the spending allowance was modified |
| value | uint256 | The new allowance from the owner to the spender |




## Functions
### balanceOf


`function balanceOf(address account) external view returns (uint256)` view external

Returns the balance of a token



| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | The account for which to look up the number of tokens it has, i.e. its balance |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The number of tokens held by the account |

### transfer


`function transfer(address recipient, uint256 amount) external returns (bool)`  external

Transfers the amount of token from the &#x60;msg.sender&#x60; to the recipient



| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | The account that will receive the amount transferred |
| amount | uint256 | The number of tokens to send from the sender to the recipient |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | Returns true for a successful transfer, false for an unsuccessful transfer |

### allowance


`function allowance(address owner, address spender) external view returns (uint256)` view external

Returns the current allowance given to a spender by an owner



| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The account of the token owner |
| spender | address | The account of the token spender |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The current allowance granted by &#x60;owner&#x60; to &#x60;spender&#x60; |

### approve


`function approve(address spender, uint256 amount) external returns (bool)`  external

Sets the allowance of a spender from the &#x60;msg.sender&#x60; to the value &#x60;amount&#x60;



| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address | The account which will be allowed to spend a given amount of the owners tokens |
| amount | uint256 | The amount of tokens allowed to be used by &#x60;spender&#x60; |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | Returns true for a successful approval, false for unsuccessful |

### transferFrom


`function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)`  external

Transfers &#x60;amount&#x60; tokens from &#x60;sender&#x60; to &#x60;recipient&#x60; up to the allowance given to the &#x60;msg.sender&#x60;



| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | The account from which the transfer will be initiated |
| recipient | address | The recipient of the transfer |
| amount | uint256 | The amount of the transfer |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | Returns true for a successful transfer, false for unsuccessful |

### mintAndFreeze


`function mintAndFreeze(address _to, uint256 _amount, uint64 _until) external returns (bool)`  external


*Developer note: Mint the specified amount of token to the specified address and freeze it until the specified date.
    Be careful, gas usage is not deterministic,
    and depends on how many freezes _to address already has.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| _to | address | Address to which token will be freeze. |
| _amount | uint256 | Amount of token to mint and freeze. |
| _until | uint64 | Release date, must be in future. |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | A boolean that indicates if the operation was successful. |

### releaseOnce


`function releaseOnce() external`  external


*Developer note: release first available freezing tokens.*





### getFreezing


`function getFreezing(address _addr, uint256 _index) external view returns (uint64 _release, uint256 _balance)` view external


*Developer note: gets freezing end date and freezing balance for the freezing portion specified by index.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| _addr | address | Address of freeze tokens owner. |
| _index | uint256 | Freezing portion index. It ordered by release date descending. |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _release | uint64 |  |
| _balance | uint256 |  |




