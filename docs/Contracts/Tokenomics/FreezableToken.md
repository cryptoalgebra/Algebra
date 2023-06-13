

# FreezableToken








## Events
### Freezed


`event Freezed(address to, uint64 release, uint256 amount)`  





| Name | Type | Description |
| ---- | ---- | ----------- |
| to | address |  |
| release | uint64 |  |
| amount | uint256 |  |


### Released


`event Released(address owner, uint256 amount)`  





| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address |  |
| amount | uint256 |  |




## Functions
### balanceOf


`function balanceOf(address _owner) public view returns (uint256 balance)` view public


*Developer note: Gets the balance of the specified address include freezing tokens.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | The address to query the the balance of. |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| balance | uint256 | An uint256 representing the amount owned by the passed address. |

### actualBalanceOf


`function actualBalanceOf(address _owner) public view returns (uint256 balance)` view public


*Developer note: Gets the balance of the specified address without freezing tokens.*



| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address | The address to query the the balance of. |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| balance | uint256 | n uint256 representing the amount owned by the passed address. |

### freezingBalanceOf


`function freezingBalanceOf(address _owner) public view returns (uint256 balance)` view public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _owner | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| balance | uint256 |  |




