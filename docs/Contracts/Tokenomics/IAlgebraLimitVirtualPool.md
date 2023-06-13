

# IAlgebraLimitVirtualPool










## Functions
### desiredEndTimestamp


`function desiredEndTimestamp() external view returns (uint32)` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

### desiredStartTimestamp


`function desiredStartTimestamp() external view returns (uint32)` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

### isFinished


`function isFinished() external view returns (bool)` view external






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

### finish


`function finish() external returns (bool wasFinished, uint32 activeTime)`  external

Finishes incentive if it wasn&#x27;t
*Developer note: This function is called by a AlgebraLimitFarming when someone calls #exitFarming() after the end timestamp*




**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| wasFinished | bool | Was incentive finished before this call or not |
| activeTime | uint32 | The summary amount of seconds inside active positions |




