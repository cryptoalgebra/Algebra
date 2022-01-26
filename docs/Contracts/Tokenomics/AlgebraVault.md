

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



### address ALGB 



### address owner 



### address relayer 




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

`transferALGB()`  external







### setRelayer

onlyOwner

`setRelayer(address)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _relayer | address |  |


### transferOwner

onlyOwner

`transferOwner(address)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _newOwner | address |  |




---


