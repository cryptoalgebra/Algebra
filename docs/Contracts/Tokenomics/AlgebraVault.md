

# AlgebraVault




## Modifiers
### onlyOwner









### onlyRelayerOrOwner










## Events
### Swap


`Swap(contract IERC20,bytes,uint256,uint256)`  





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


`constructor(address,address,contract ISwapRouter)`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _ALGB | address |  |
| _stakingAddress | address |  |
| _AlgebraRouter | contract ISwapRouter |  |


### swapToALGB

onlyRelayerOrOwner

`swapToALGB(contract IERC20,bytes,uint256,uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| tokenToSwap | contract IERC20 |  |
| path | bytes |  |
| amountOutMin | uint256 |  |
| withFee | uint256 |  |


### transferALGB

onlyRelayerOrOwner

`transferALGB(uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| percentToTransfer | uint256 |  |


### setRelayer

onlyOwner

`setRelayer(address)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _relayer | address |  |


### setStakingAddress

onlyOwner

`setStakingAddress(address)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _staking | address |  |


### sweepTokens

onlyOwner

`sweepTokens(contract IERC20,uint256,address)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| token | contract IERC20 |  |
| amount | uint256 |  |
| _to | address |  |


### transferALGBToStaking

onlyRelayerOrOwner

`transferALGBToStaking()`  external







### collectAccumulatedALGB

onlyOwner

`collectAccumulatedALGB()`  external







### setStartTime

onlyOwner

`setStartTime(uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _startTime | uint256 |  |


### setAmountByBack

onlyOwner

`setAmountByBack(uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 |  |


### setMaxCount

onlyOwner

`setMaxCount(uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _maxCount | uint256 |  |


### setRate

onlyOwner

`setRate(uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _rate | uint256 |  |


### transferOwner

onlyOwner

`transferOwner(address)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _newOwner | address |  |




---


