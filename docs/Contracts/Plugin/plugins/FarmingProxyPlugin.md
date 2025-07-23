

# FarmingProxyPlugin


Algebra Integral 1.2.1 default plugin

This contract stores timepoints and calculates adaptive fee and statistical averages

**Inherits:** AlgebraBasePlugin [IFarmingPlugin](../interfaces/plugins/IFarmingPlugin.md)

## Public variables
### incentive
```solidity
address incentive
```
**Selector**: `0x1d4632ac`

Returns the address of active incentive

*Developer note: if there is no active incentive at the moment, incentiveAddress would be equal to address(0)*


## Functions
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

### getPool

```solidity
function getPool() external view returns (address)
```
**Selector**: `0x026b1d5f`

Returns the address of the pool the plugin is created for

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | address of the pool |

