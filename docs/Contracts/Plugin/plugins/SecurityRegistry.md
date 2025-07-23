

# SecurityRegistry






**Inherits:** [ISecurityRegistry](../interfaces/plugins/ISecurityRegistry.md)

## Public variables
### algebraFactory
```solidity
address immutable algebraFactory
```
**Selector**: `0xa7b64b04`




### GUARD
```solidity
bytes32 constant GUARD = 0x25bca7788d8c23352e368ccd4774eb5b5fc3d40422de2c14e98631ab71f33415
```
**Selector**: `0xfe3348f9`




### globalStatus
```solidity
enum ISecurityRegistry.Status globalStatus
```
**Selector**: `0xb73f7951`




### isPoolStatusOverrided
```solidity
bool isPoolStatusOverrided
```
**Selector**: `0x853b8c5c`




### poolStatus
```solidity
mapping(address => enum ISecurityRegistry.Status) poolStatus
```
**Selector**: `0x3c38ccbb`





## Functions
### constructor

```solidity
constructor(address _algebraFactory) public
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| _algebraFactory | address |  |

### setPoolsStatus

```solidity
function setPoolsStatus(address[] pools, enum ISecurityRegistry.Status[] newStatuses) external
```
**Selector**: `0x6547cd53`



| Name | Type | Description |
| ---- | ---- | ----------- |
| pools | address[] |  |
| newStatuses | enum ISecurityRegistry.Status[] |  |

### setGlobalStatus

```solidity
function setGlobalStatus(enum ISecurityRegistry.Status newStatus) external
```
**Selector**: `0x24b62cd0`



| Name | Type | Description |
| ---- | ---- | ----------- |
| newStatus | enum ISecurityRegistry.Status |  |

### getPoolStatus

```solidity
function getPoolStatus(address pool) external view returns (enum ISecurityRegistry.Status)
```
**Selector**: `0x15d9d2f9`



| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | enum ISecurityRegistry.Status |  |

