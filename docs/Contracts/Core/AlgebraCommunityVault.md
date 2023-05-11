

# AlgebraCommunityVault


Algebra community fee vault
Community fee from pools is sent here, if it is enabled

## Modifiers
### onlyWithdrawer


`modifier onlyWithdrawer()`  internal








## Events
### TokensWithdrawal


`event TokensWithdrawal(address token, address to, uint256 amount)`  





| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address |  |
| to | address |  |
| amount | uint256 |  |



## Variables
### bytes32 COMMUNITY_FEE_WITHDRAWER_ROLE constant



*Developer note: The role can be granted in AlgebraFactory*

## Functions
### constructor


`constructor() public`  public







### withdraw


`function withdraw(address token, address to, uint256 amount) external`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address |  |
| to | address |  |
| amount | uint256 |  |


### withdrawTokens


`function withdrawTokens(struct AlgebraCommunityVault.WithdrawTokensParams[] params) external`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| params | struct AlgebraCommunityVault.WithdrawTokensParams[] |  |






---

