

# AlgebraCommunityVault


Algebra community fee vault

Community fee from pools is sent here, if it is enabled

*Developer note: Role system is used to withdraw tokens
Version: Algebra Integral*

## Modifiers
### onlyFactoryOwner


```solidity
modifier onlyFactoryOwner()
```  internal



### onlyWithdrawer


```solidity
modifier onlyWithdrawer()
```  internal



### onlyAlgebraFeeManager


```solidity
modifier onlyAlgebraFeeManager()
```  internal




## Variables
### bytes32 COMMUNITY_FEE_WITHDRAWER_ROLE constant



*Developer note: The role can be granted in AlgebraFactory*
### address communityFeeReceiver 

Address to which community fees are sent from vault

### uint16 algebraFee 

The percentage of the protocol fee that Algebra will receive

*Developer note: Value in thousandths,i.e. 1e-3*
### bool hasNewAlgebraFeeProposal 

Represents whether there is a new Algebra fee proposal or not

### uint16 proposedNewAlgebraFee 

Suggested Algebra fee value

### address algebraFeeReceiver 

Address of recipient Algebra part of community fee

### address algebraFeeManager 

Address of Algebra fee manager


## Functions
### constructor


```solidity
constructor(address _algebraFeeManager) public
```  public



| Name | Type | Description |
| ---- | ---- | ----------- |
| _algebraFeeManager | address |  |

### withdraw


```solidity
function withdraw(address token, uint256 amount) external
```  external

Withdraw protocol fees from vault

*Developer note: Can only be called by algebraFeeManager or communityFeeReceiver*

| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | The token address |
| amount | uint256 | The amount of token |

### withdrawTokens


```solidity
function withdrawTokens(struct IAlgebraCommunityVault.WithdrawTokensParams[] params) external
```  external

Withdraw protocol fees from vault. Used to claim fees for multiple tokens

*Developer note: Can be called by algebraFeeManager or communityFeeReceiver*

| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct IAlgebraCommunityVault.WithdrawTokensParams[] | Array of WithdrawTokensParams objects containing token addresses and amounts to withdraw |

### acceptAlgebraFeeChangeProposal


```solidity
function acceptAlgebraFeeChangeProposal(uint16 newAlgebraFee) external
```  external

Accepts the proposed new Algebra fee

*Developer note: Can only be called by the factory owner*

| Name | Type | Description |
| ---- | ---- | ----------- |
| newAlgebraFee | uint16 | New Algebra fee value |

### changeCommunityFeeReceiver


```solidity
function changeCommunityFeeReceiver(address newCommunityFeeReceiver) external
```  external

Change community fee receiver address

*Developer note: Can only be called by the factory owner*

| Name | Type | Description |
| ---- | ---- | ----------- |
| newCommunityFeeReceiver | address | New community fee receiver address |

### transferAlgebraFeeManagerRole


```solidity
function transferAlgebraFeeManagerRole(address _newAlgebraFeeManager) external
```  external

Transfers Algebra fee manager role

| Name | Type | Description |
| ---- | ---- | ----------- |
| _newAlgebraFeeManager | address | new Algebra fee manager address |

### acceptAlgebraFeeManagerRole


```solidity
function acceptAlgebraFeeManagerRole() external
```  external

accept Algebra FeeManager role

### proposeAlgebraFeeChange


```solidity
function proposeAlgebraFeeChange(uint16 newAlgebraFee) external
```  external

Proposes new Algebra fee value for protocol

| Name | Type | Description |
| ---- | ---- | ----------- |
| newAlgebraFee | uint16 | new Algebra fee value |

### cancelAlgebraFeeChangeProposal


```solidity
function cancelAlgebraFeeChangeProposal() external
```  external

Cancels Algebra fee change proposal

### changeAlgebraFeeReceiver


```solidity
function changeAlgebraFeeReceiver(address newAlgebraFeeReceiver) external
```  external

Change Algebra community fee part receiver

| Name | Type | Description |
| ---- | ---- | ----------- |
| newAlgebraFeeReceiver | address | The address of new Algebra fee receiver |

