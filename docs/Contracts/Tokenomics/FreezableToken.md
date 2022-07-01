

# FreezableToken





## Events
### Freezed


`Freezed(address,uint64,uint256)`  





| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address |  |
| release | uint64 |  |
| amount | uint256 |  |


### Released


`Released(address,uint256)`  





| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| amount | uint256 |  |




## Functions
### balanceOf


`balanceOf(address)` view public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | The address to query the the balance of. |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| balance | uint256 |  |

### actualBalanceOf


`actualBalanceOf(address)` view public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | The address to query the the balance of. |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| balance | uint256 |  |

### freezingBalanceOf


`freezingBalanceOf(address)` view public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| balance | uint256 |  |



---


