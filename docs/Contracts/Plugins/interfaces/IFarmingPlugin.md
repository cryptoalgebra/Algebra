

# IFarmingPlugin


The interface for the Algebra farming plugin



*Developer note: This contract used for virtual pools in farms*


## Events
### Incentive

```solidity
event Incentive(address newIncentive)
```

Emitted when new activeIncentive is set

| Name | Type | Description |
| ---- | ---- | ----------- |
| newIncentive | address | The address of the new incentive |


## Functions
### pool

```solidity
function pool() external returns (address)
```

Returns the address of the pool the plugin is created for

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | address of the pool |

### setIncentive

```solidity
function setIncentive(address newIncentive) external
```

Sets an active incentive. Only farming

| Name | Type | Description |
| ---- | ---- | ----------- |
| newIncentive | address | The address associated with the incentive |

### isIncentiveActive

```solidity
function isIncentiveActive(address targetIncentive) external view returns (bool)
```

Checks if the incentive is active

*Developer note: Returns false if the plugin has a different incentive set, the plugin is not connected to the pool,
or the plugin configuration is incorrect.*

| Name | Type | Description |
| ---- | ---- | ----------- |
| targetIncentive | address | The address of the incentive to be checked |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | Indicates whether the target incentive is active |

### incentive

```solidity
function incentive() external view returns (address)
```

Returns the address of active incentive

*Developer note: if there is no active incentive at the moment, incentiveAddress would be equal to address(0)*

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The address associated with the current active incentive |

