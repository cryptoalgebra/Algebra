

# VirtualPoolDeployer

## Modifiers
### onlyFarming









### onlyOwner












## Functions
### constructor


`constructor()`  public







### setFarming

onlyOwner

`setFarming(address)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _farming | address |  |


### deploy

onlyFarming

`deploy(address,address,uint32,uint32)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| poolAddress | address |  |
| _farming | address |  |
| _desiredStartTimestamp | uint32 |  |
| _desiredEndTimestamp | uint32 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPool | address |  |



---


