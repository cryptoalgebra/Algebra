

# IncentiveVirtualPool






## Variables
### uint32 initTimestamp 



### uint32 endTimestamp 



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

`finish(uint32,uint32)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| _endTimestamp | uint32 | The timestamp of the exitFarming |
| startTime | uint32 | The timestamp of planned start of the incentive. Used as initTimestamp if there were no swaps through the entire incentive |


### getInnerSecondsPerLiquidity


`getInnerSecondsPerLiquidity(int24,int24)` view external





| Name | Type | Description |
| ---- | ---- | ----------- |
| bottomTick | int24 | The bottom tick of a position |
| topTick | int24 | The top tick of a position |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| innerSecondsSpentPerLiquidity | uint160 |  |
| initTime | uint32 |  |
| endTime | uint32 |  |



---


