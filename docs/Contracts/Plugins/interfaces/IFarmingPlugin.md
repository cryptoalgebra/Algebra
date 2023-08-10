

# IFarmingPlugin


The interface for the Algebra farming plugin



*Developer note: This contract used for virtual pools in farms*


## Events
### Incentive

```solidity
event Incentive(address newIncentive)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| newIncentive | address |  |


## Functions
### setIncentive

```solidity
function setIncentive(address newIncentive) external
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| newIncentive | address |  |

### isIncentiveActive

```solidity
function isIncentiveActive(address targetIncentive) external view returns (bool)
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| targetIncentive | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool |  |

### incentive

```solidity
function incentive() external view returns (address)
```



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address |  |

