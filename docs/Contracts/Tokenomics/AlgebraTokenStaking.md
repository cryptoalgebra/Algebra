

# AlgebraTokenStaking




## Modifiers
### onlyOwner










## Events
### Entered


`Entered(address,uint256,uint256)`  





| Name | Type | Description |
| ---- | ---- | ----------- |
| staker | address |  |
| ALGBAmount | uint256 |  |
| xALGBAmount | uint256 |  |


### Left


`Left(address,uint256,uint256)`  





| Name | Type | Description |
| ---- | ---- | ----------- |
| staker | address |  |
| xALGBAmount | uint256 |  |
| ALGBAmount | uint256 |  |



## Variables
### uint256 freezeTime 



### address owner 



### contract IERC20Minimal ALGB 




## Functions
### constructor

ERC20

`constructor(contract IERC20Minimal)`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _ALGB | contract IERC20Minimal |  |


### enter


`enter(uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 |  |


### leave


`leave(uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _share | uint256 |  |


### currentBalance


`currentBalance(uint256)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### setFreezeTime

onlyOwner

`setFreezeTime(uint256)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _freezeTime | uint256 |  |


### transferOwner

onlyOwner

`transferOwner(address)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _newOwner | address |  |




---


