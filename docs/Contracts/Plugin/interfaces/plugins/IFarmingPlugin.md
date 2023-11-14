

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
function pool() external view returns (address)
```
**Selector**: `0x16f0115b`

Returns the address of the pool the plugin is created for

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | address of the pool |

### setIncentive

```solidity
function setIncentive(address newIncentive) external
```
**Selector**: `0x7c1fe0c8`

Connects or disconnects an incentive.

*Developer note: Only farming can connect incentives.
The one who connected it and the current farming has the right to disconnect the incentive.*

| Name | Type | Description |
| ---- | ---- | ----------- |
| newIncentive | address | The address associated with the incentive or zero address |

### isIncentiveConnected

```solidity
function isIncentiveConnected(address targetIncentive) external view returns (bool)
```
**Selector**: `0xe63015f0`

Checks if the incentive is connected to pool

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
**Selector**: `0x1d4632ac`

Returns the address of active incentive

*Developer note: if there is no active incentive at the moment, incentiveAddress would be equal to address(0)*

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | The address associated with the current active incentive |

