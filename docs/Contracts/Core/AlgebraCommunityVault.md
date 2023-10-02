

# AlgebraCommunityVault


Algebra community fee vault

Community fee from pools is sent here, if it is enabled

*Developer note: Role system is used to withdraw tokens
Version: Algebra Integral*

**Inherits:** [IAlgebraCommunityVault](interfaces/IAlgebraCommunityVault.md)
## Modifiers
### onlyAdministrator

```solidity
modifier onlyAdministrator()
```



### onlyWithdrawer

```solidity
modifier onlyWithdrawer()
```



### onlyAlgebraFeeManager

```solidity
modifier onlyAlgebraFeeManager()
```




## Public variables
### COMMUNITY_FEE_WITHDRAWER_ROLE
```solidity
bytes32 constant COMMUNITY_FEE_WITHDRAWER_ROLE = 0xb77a63f119f4dc2174dc6c76fc1a1565fa4f2b0dde50ed5c0465471cd9b331f6
```
**Selector**: `0x1de41613`



*Developer note: The role can be granted in AlgebraFactory*

### COMMUNITY_FEE_VAULT_ADMINISTRATOR
```solidity
bytes32 constant COMMUNITY_FEE_VAULT_ADMINISTRATOR = 0x63e58c34d94475ba3fc063e19800b940485850d84d09cd3c1f2c14192c559a68
```
**Selector**: `0xbbac3b8d`



*Developer note: The role can be granted in AlgebraFactory*

### communityFeeReceiver
```solidity
address communityFeeReceiver
```
**Selector**: `0x371abc95`

Address to which community fees are sent from vault


### algebraFee
```solidity
uint16 algebraFee
```
**Selector**: `0x9f856b8d`

The percentage of the protocol fee that Algebra will receive

*Developer note: Value in thousandths,i.e. 1e-3*

### hasNewAlgebraFeeProposal
```solidity
bool hasNewAlgebraFeeProposal
```
**Selector**: `0xc53b3fbe`

Represents whether there is a new Algebra fee proposal or not


### proposedNewAlgebraFee
```solidity
uint16 proposedNewAlgebraFee
```
**Selector**: `0x62744405`

Suggested Algebra fee value


### algebraFeeReceiver
```solidity
address algebraFeeReceiver
```
**Selector**: `0x4738761c`

Address of recipient Algebra part of community fee


### algebraFeeManager
```solidity
address algebraFeeManager
```
**Selector**: `0x9d754dde`

Address of Algebra fee manager



## Functions
### constructor

```solidity
constructor(address _algebraFeeManager) public
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| _algebraFeeManager | address |  |

### withdraw

```solidity
function withdraw(address token, uint256 amount) external
```
**Selector**: `0xf3fef3a3`

Withdraw protocol fees from vault

*Developer note: Can only be called by algebraFeeManager or communityFeeReceiver*

| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | The token address |
| amount | uint256 | The amount of token |

### withdrawTokens

```solidity
function withdrawTokens(struct IAlgebraCommunityVault.WithdrawTokensParams[] params) external
```
**Selector**: `0xdfadc794`

Withdraw protocol fees from vault. Used to claim fees for multiple tokens

*Developer note: Can be called by algebraFeeManager or communityFeeReceiver*

| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct IAlgebraCommunityVault.WithdrawTokensParams[] | Array of WithdrawTokensParams objects containing token addresses and amounts to withdraw |

### acceptAlgebraFeeChangeProposal

```solidity
function acceptAlgebraFeeChangeProposal(uint16 newAlgebraFee) external
```
**Selector**: `0xff3c43e1`

Accepts the proposed new Algebra fee

*Developer note: Can only be called by the factory owner.
The new value will also be used for previously accumulated tokens that have not yet been withdrawn*

| Name | Type | Description |
| ---- | ---- | ----------- |
| newAlgebraFee | uint16 | New Algebra fee value |

### changeCommunityFeeReceiver

```solidity
function changeCommunityFeeReceiver(address newCommunityFeeReceiver) external
```
**Selector**: `0xb5f680ae`

Change community fee receiver address

*Developer note: Can only be called by the factory owner*

| Name | Type | Description |
| ---- | ---- | ----------- |
| newCommunityFeeReceiver | address | New community fee receiver address |

### transferAlgebraFeeManagerRole

```solidity
function transferAlgebraFeeManagerRole(address _newAlgebraFeeManager) external
```
**Selector**: `0x50eea0c8`

Transfers Algebra fee manager role

| Name | Type | Description |
| ---- | ---- | ----------- |
| _newAlgebraFeeManager | address | new Algebra fee manager address |

### acceptAlgebraFeeManagerRole

```solidity
function acceptAlgebraFeeManagerRole() external
```
**Selector**: `0xad6129ac`

accept Algebra FeeManager role

### proposeAlgebraFeeChange

```solidity
function proposeAlgebraFeeChange(uint16 newAlgebraFee) external
```
**Selector**: `0xd9fb4353`

Proposes new Algebra fee value for protocol

*Developer note: the new value will also be used for previously accumulated tokens that have not yet been withdrawn*

| Name | Type | Description |
| ---- | ---- | ----------- |
| newAlgebraFee | uint16 | new Algebra fee value |

### cancelAlgebraFeeChangeProposal

```solidity
function cancelAlgebraFeeChangeProposal() external
```
**Selector**: `0xd17bc783`

Cancels Algebra fee change proposal

### changeAlgebraFeeReceiver

```solidity
function changeAlgebraFeeReceiver(address newAlgebraFeeReceiver) external
```
**Selector**: `0x48a50fcf`

Change Algebra community fee part receiver

| Name | Type | Description |
| ---- | ---- | ----------- |
| newAlgebraFeeReceiver | address | The address of new Algebra fee receiver |

