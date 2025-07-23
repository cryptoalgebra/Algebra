

# ISecurityRegistry







## Events
### GlobalStatus

```solidity
event GlobalStatus(enum ISecurityRegistry.Status status)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| status | enum ISecurityRegistry.Status |  |

### PoolStatus

```solidity
event PoolStatus(address pool, enum ISecurityRegistry.Status status)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address |  |
| status | enum ISecurityRegistry.Status |  |


## Functions
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
function getPoolStatus(address pool) external returns (enum ISecurityRegistry.Status)
```
**Selector**: `0x15d9d2f9`



| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | enum ISecurityRegistry.Status |  |

### setPoolsStatus

```solidity
function setPoolsStatus(address[] pools, enum ISecurityRegistry.Status[] newStatuses) external
```
**Selector**: `0x6547cd53`



| Name | Type | Description |
| ---- | ---- | ----------- |
| pools | address[] |  |
| newStatuses | enum ISecurityRegistry.Status[] |  |

### algebraFactory

```solidity
function algebraFactory() external view returns (address)
```
**Selector**: `0xa7b64b04`



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

### GUARD

```solidity
function GUARD() external pure returns (bytes32)
```
**Selector**: `0xfe3348f9`



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32 |  |

### globalStatus

```solidity
function globalStatus() external view returns (enum ISecurityRegistry.Status)
```
**Selector**: `0xb73f7951`



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | enum ISecurityRegistry.Status |  |

### isPoolStatusOverrided

```solidity
function isPoolStatusOverrided() external view returns (bool)
```
**Selector**: `0x853b8c5c`



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |


## Errors
## OnlyOwner

```solidity
error OnlyOwner()
```
**Selector**: `0x5fc483c5`



