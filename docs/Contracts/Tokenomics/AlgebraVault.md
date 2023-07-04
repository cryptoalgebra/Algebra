

# AlgebraVault







## Modifiers
### onlyOwner


`modifier onlyOwner()`  internal







### onlyRelayerOrOwner


`modifier onlyRelayerOrOwner()`  internal








## Events
### Swap


`event Swap(contract IERC20 swappedToken, bytes path, uint256 amountIn, uint256 amountOut)`  





| Name | Type | Description |
| ---- | ---- | ----------- |
| swappedToken | contract IERC20 |  |
| path | bytes |  |
| amountIn | uint256 |  |
| amountOut | uint256 |  |



## Variables
### address stakingAddress 



### address ALGB immutable



### address owner 



### address relayer 



### uint256 accumulatedALGB 



### uint256 startTime 



### uint256 count 



### uint256 maxCount 



### uint256 transferRate 



### uint256 amountToTransferByBack 




## Functions
### constructor


`constructor(address _ALGB, address _stakingAddress, contract ISwapRouter _AlgebraRouter) public`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _ALGB | address |  |
| _stakingAddress | address |  |
| _AlgebraRouter | contract ISwapRouter |  |


### swapToALGB


`function swapToALGB(contract IERC20 tokenToSwap, bytes path, uint256 amountOutMin, uint256 withFee) external`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenToSwap | contract IERC20 |  |
| path | bytes |  |
| amountOutMin | uint256 |  |
| withFee | uint256 |  |


### transferALGB


`function transferALGB(uint256 percentToTransfer) external`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| percentToTransfer | uint256 |  |


### setRelayer


`function setRelayer(address _relayer) external`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _relayer | address |  |


### setStakingAddress


`function setStakingAddress(address _staking) external`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _staking | address |  |


### sweepTokens


`function sweepTokens(contract IERC20 token, uint256 amount, address _to) external`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| token | contract IERC20 |  |
| amount | uint256 |  |
| _to | address |  |


### transferALGBToStaking


`function transferALGBToStaking() external`  external







### collectAccumulatedALGB


`function collectAccumulatedALGB() external`  external







### setStartTime


`function setStartTime(uint256 _startTime) external`  external


*Developer note: Sets start time of backend transfers campaign*



| Name | Type | Description |
| ---- | ---- | ----------- |
| _startTime | uint256 |  |


### setAmountByBack


`function setAmountByBack(uint256 _amount) external`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 |  |


### setMaxCount


`function setMaxCount(uint256 _maxCount) external`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _maxCount | uint256 |  |


### setRate


`function setRate(uint256 _rate) external`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _rate | uint256 |  |


### transferOwner


`function transferOwner(address _newOwner) external`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _newOwner | address |  |





