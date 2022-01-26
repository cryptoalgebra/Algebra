

# IVirtualPoolDeployer


## Events
### FarmingAddressChanged


`FarmingAddressChanged(address,address)`  

Emitted when the farming address is changed



| Name | Type | Description |
| ---- | ---- | ----------- |
| farming | address | The farming address before the address was changed |
| _farming | address | The farming address after the address was changed |




## Functions
### deploy


`deploy(address,address,uint32,uint32)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address |  |
| farming | address |  |
| desiredStartTimestamp | uint32 |  |
| desiredEndTimestamp | uint32 |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| virtualPool | address |  |

### setFarming


`setFarming(address)`  external





| Name | Type | Description |
| ---- | ---- | ----------- |
| farming | address | The address of the Algebra framing |




---


