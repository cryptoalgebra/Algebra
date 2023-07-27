

# IAlgebraCommunityVault


The interface for the Algebra community fee vault

Community fee from pools is sent here, if it is enabled

*Developer note: Version: Algebra Integral*


## Events
### TokensWithdrawal


```solidity
event TokensWithdrawal(address token, address to, uint256 amount)
```  

Event emitted when a fees has been claimed

| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | The address of token fee |
| to | address | The address where claimed rewards were sent to |
| amount | uint256 | The amount of fees tokens claimed by communityFeeReceiver |

### AlgebraTokensWithdrawal


```solidity
event AlgebraTokensWithdrawal(address token, address to, uint256 amount)
```  

Event emitted when a fees has been claimed

| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | The address of token fee |
| to | address | The address where claimed rewards were sent to |
| amount | uint256 | The amount of fees tokens claimed by Algebra |

### AlgebraFeeReceiver


```solidity
event AlgebraFeeReceiver(address newAlgebraFeeReceiver)
```  

Emitted when a AlgebraFeeReceiver address changed

| Name | Type | Description |
| ---- | ---- | ----------- |
| newAlgebraFeeReceiver | address | New Algebra fee receiver address |

### AlgebraFeeManager


```solidity
event AlgebraFeeManager(address newAlgebraFeeManager)
```  

Emitted when a AlgebraFeeManager address changed

| Name | Type | Description |
| ---- | ---- | ----------- |
| newAlgebraFeeManager | address | New Algebra fee manager address |

### AlgebraFee


```solidity
event AlgebraFee(uint16 newAlgebraFee)
```  

Emitted when the Algebra fee is changed

| Name | Type | Description |
| ---- | ---- | ----------- |
| newAlgebraFee | uint16 | The new Algebra fee value |

### CommunityFeeReceiver


```solidity
event CommunityFeeReceiver(address newCommunityFeeReceiver)
```  

Emitted when a CommunityFeeReceiver address changed

| Name | Type | Description |
| ---- | ---- | ----------- |
| newCommunityFeeReceiver | address | New fee receiver address |


## Functions
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

