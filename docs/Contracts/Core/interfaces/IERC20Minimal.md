

# IERC20Minimal


Minimal ERC20 interface for Algebra

Contains a subset of the full ERC20 interface that is used in Algebra

*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-core/tree/main/contracts/interfaces*


## Events
### Transfer

```solidity
event Transfer(address from, address to, uint256 value)
```

Event emitted when tokens are transferred from one address to another, either via &#x60;#transfer&#x60; or &#x60;#transferFrom&#x60;.

| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | The account from which the tokens were sent, i.e. the balance decreased |
| to | address | The account to which the tokens were sent, i.e. the balance increased |
| value | uint256 | The amount of tokens that were transferred |

### Approval

```solidity
event Approval(address owner, address spender, uint256 value)
```

Event emitted when the approval amount for the spender of a given owner&#x27;s tokens changes.

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The account that approved spending of its tokens |
| spender | address | The account for which the spending allowance was modified |
| value | uint256 | The new allowance from the owner to the spender |


## Functions
### balanceOf

```solidity
function balanceOf(address account) external view returns (uint256)
```
**Selector**: `0x70a08231`

Returns the balance of a token

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | The account for which to look up the number of tokens it has, i.e. its balance |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The number of tokens held by the account |

### transfer

```solidity
function transfer(address recipient, uint256 amount) external returns (bool)
```
**Selector**: `0xa9059cbb`

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

```solidity
function allowance(address owner, address spender) external view returns (uint256)
```
**Selector**: `0xdd62ed3e`

Returns the current allowance given to a spender by an owner

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The account of the token owner |
| spender | address | The account of the token spender |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The current allowance granted by `owner` to `spender` |

### approve

```solidity
function approve(address spender, uint256 amount) external returns (bool)
```
**Selector**: `0x095ea7b3`

Sets the allowance of a spender from the &#x60;msg.sender&#x60; to the value &#x60;amount&#x60;

| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address | The account which will be allowed to spend a given amount of the owners tokens |
| amount | uint256 | The amount of tokens allowed to be used by `spender` |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | Returns true for a successful approval, false for unsuccessful |

### transferFrom

```solidity
function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)
```
**Selector**: `0x23b872dd`

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

