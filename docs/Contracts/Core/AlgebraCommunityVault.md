

# AlgebraCommunityVault


Algebra community fee vault

Community fee from pools is sent here, if it is enabled

*Developer note: Role system is used to withdraw tokens
Version: Algebra Integral*

## Modifiers
### onlyFactoryOwner


`modifier onlyFactoryOwner()`  internal







### onlyWithdrawer


`modifier onlyWithdrawer()`  internal







### onlyAlgebraFeeManager


`modifier onlyAlgebraFeeManager()`  internal








## Events
### TokensWithdrawal


`event TokensWithdrawal(address token, address to, uint256 amount)`  

Event emitted when a fees has been claimed



| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | The address of token fee |
| to | address | The address where claimed rewards were sent to |
| amount | uint256 | The amount of fees tokens claimed by communityFeeReceiver |


### AlgebraTokensWithdrawal


`event AlgebraTokensWithdrawal(address token, address to, uint256 amount)`  

Event emitted when a fees has been claimed



| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | The address of token fee |
| to | address | The address where claimed rewards were sent to |
| amount | uint256 | The amount of fees tokens claimed by Algebra |


### AlgebraFeeReceiver


`event AlgebraFeeReceiver(address newAlgebraFeeReceiver)`  

Emitted when a AlgebraFeeReceiver address changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| newAlgebraFeeReceiver | address | New Algebra fee receiver address |


### AlgebraFee


`event AlgebraFee(uint16 newAlgebraFee)`  

Emitted when the Algebra fee is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| newAlgebraFee | uint16 | The new Algebra fee value |


### CommunityFeeReceiver


`event CommunityFeeReceiver(address newCommunityFeeReceiver)`  

Emitted when a CommunityFeeReceiver address changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| newCommunityFeeReceiver | address | New fee receiver address |



## Variables
### bytes32 COMMUNITY_FEE_WITHDRAWER_ROLE constant



*Developer note: The role can be granted in AlgebraFactory*
### address communityFeeReceiver 

Address to which protocol commissions are sent from vault

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


`constructor(address _algebraFeeManager) public`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _algebraFeeManager | address |  |


### withdraw


`function withdraw(address token, uint256 amount) external`  external

Withdraw protocol fees from vault
*Developer note: Can only be called by algebraFeeManager or communityFeeReceiver*



| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | The token address |
| amount | uint256 | The amount of token |


### withdrawTokens


`function withdrawTokens(struct AlgebraCommunityVault.WithdrawTokensParams[] params) external`  external

Withdraw protocol fees from vault. Used to claim fees for multiple tokens
*Developer note: Can be called by algebraFeeManager or communityFeeReceiver*



| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct AlgebraCommunityVault.WithdrawTokensParams[] | Array of WithdrawTokensParams objects containing token addresses and amounts to withdraw |


### acceptAlgebraFeeChangeProposal


`function acceptAlgebraFeeChangeProposal(uint16 newAlgebraFee) external`  external

Accepts the proposed new Algebra fee
*Developer note: Can only be called by the factory owner*



| Name | Type | Description |
| ---- | ---- | ----------- |
| newAlgebraFee | uint16 | New Algebra fee value |


### changeCommunityFeeReceiver


`function changeCommunityFeeReceiver(address newCommunityFeeReceiver) external`  external

Change community fee receiver address
*Developer note: Can only be called by the factory owner*



| Name | Type | Description |
| ---- | ---- | ----------- |
| newCommunityFeeReceiver | address | New community fee receiver address |


### transferAlgebraFeeManagerRole


`function transferAlgebraFeeManagerRole(address _newAlgebraFeeManager) external`  external

Transfers Algebra fee manager role



| Name | Type | Description |
| ---- | ---- | ----------- |
| _newAlgebraFeeManager | address | new Algebra fee manager address |


### acceptAlgebraFeeManagerRole


`function acceptAlgebraFeeManagerRole() external`  external

Accept Algebra fee manager role





### proposeAlgebraFeeChange


`function proposeAlgebraFeeChange(uint16 newAlgebraFee) external`  external

Suggests new Algebra fee value



| Name | Type | Description |
| ---- | ---- | ----------- |
| newAlgebraFee | uint16 | new Algebra fee value |


### cancelAlgebraFeeChangeProposal


`function cancelAlgebraFeeChangeProposal() external`  external

Cancels Algebra fee change proposal





### changeAlgebraFeeReceiver


`function changeAlgebraFeeReceiver(address newAlgebraFeeReceiver) external`  external

Change Algebra community fee part receiver



| Name | Type | Description |
| ---- | ---- | ----------- |
| newAlgebraFeeReceiver | address | The address of new Algebra fee receiver |





