

# AlgebraTokenStaking







## Modifiers
### onlyOwner


`modifier onlyOwner()`  internal








## Events
### Entered


`event Entered(address staker, uint256 ALGBAmount, uint256 xALGBAmount)`  





| Name | Type | Description |
| ---- | ---- | ----------- |
| staker | address |  |
| ALGBAmount | uint256 |  |
| xALGBAmount | uint256 |  |


### Left


`event Left(address staker, uint256 xALGBAmount, uint256 ALGBAmount)`  





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


`constructor(contract IERC20Minimal _ALGB) public`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _ALGB | contract IERC20Minimal |  |


### enter


`function enter(uint256 _amount) external`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 |  |


### leave


`function leave(uint256 _share) external`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _share | uint256 |  |


### currentBalance


`function currentBalance(uint256 _amount) external view returns (uint256)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _amount | uint256 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

### setFreezeTime


`function setFreezeTime(uint256 _freezeTime) external`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _freezeTime | uint256 |  |


### transferOwner


`function transferOwner(address _newOwner) external`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _newOwner | address |  |





