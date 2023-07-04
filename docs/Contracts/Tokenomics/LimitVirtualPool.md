

# LimitVirtualPool









## Variables
### bool isFinished 



### uint32 desiredEndTimestamp immutable



### uint32 desiredStartTimestamp immutable




## Functions
### constructor


`constructor(address _farmingCenterAddress, address _farmingAddress, address _pool, uint32 _desiredStartTimestamp, uint32 _desiredEndTimestamp) public`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| _farmingCenterAddress | address |  |
| _farmingAddress | address |  |
| _pool | address |  |
| _desiredStartTimestamp | uint32 |  |
| _desiredEndTimestamp | uint32 |  |


### finish


`function finish() external returns (bool wasFinished, uint32 activeTime)`  external

Finishes incentive if it wasn&#x27;t
*Developer note: This function is called by a AlgebraLimitFarming when someone calls #exitFarming() after the end timestamp*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| wasFinished | bool | Was incentive finished before this call or not |
| activeTime | uint32 | The summary amount of seconds inside active positions |




