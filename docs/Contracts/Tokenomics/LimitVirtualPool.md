

# LimitVirtualPool






## Variables
### bool isFinished 



### uint32 desiredEndTimestamp immutable



### uint32 desiredStartTimestamp immutable




## Functions
### constructor

AlgebraVirtualPoolBase

`constructor(address,address,address,uint32,uint32)`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _farmingCenterAddress | address |  |
| _farmingAddress | address |  |
| _pool | address |  |
| _desiredStartTimestamp | uint32 |  |
| _desiredEndTimestamp | uint32 |  |


### finish

onlyFarming

`finish()`  external

Finishes incentive if it wasn&#x27;t




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| wasFinished | bool |  |
| activeTime | uint32 |  |



---


