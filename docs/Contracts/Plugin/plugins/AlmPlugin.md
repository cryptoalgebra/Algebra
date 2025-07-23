

# AlmPlugin






**Inherits:** AlgebraBasePlugin [IAlmPlugin](../interfaces/plugins/IAlmPlugin.md)

## Public variables
### rebalanceManager
```solidity
address rebalanceManager
```
**Selector**: `0x6fb5bad1`

@inheritdoc	IAlmPlugin


### slowTwapPeriod
```solidity
uint32 slowTwapPeriod
```
**Selector**: `0x841c6a37`

@inheritdoc	IAlmPlugin


### fastTwapPeriod
```solidity
uint32 fastTwapPeriod
```
**Selector**: `0xad1c3743`

@inheritdoc	IAlmPlugin



## Functions
### initializeALM

```solidity
function initializeALM(address _rebalanceManager, uint32 _slowTwapPeriod, uint32 _fastTwapPeriod) external
```
**Selector**: `0xd49dda85`

@inheritdoc	IAlmPlugin

| Name | Type | Description |
| ---- | ---- | ----------- |
| _rebalanceManager | address |  |
| _slowTwapPeriod | uint32 |  |
| _fastTwapPeriod | uint32 |  |

### setSlowTwapPeriod

```solidity
function setSlowTwapPeriod(uint32 _slowTwapPeriod) external
```
**Selector**: `0x48b2acdd`

@inheritdoc	IAlmPlugin

| Name | Type | Description |
| ---- | ---- | ----------- |
| _slowTwapPeriod | uint32 |  |

### setFastTwapPeriod

```solidity
function setFastTwapPeriod(uint32 _fastTwapPeriod) external
```
**Selector**: `0x08095141`

@inheritdoc	IAlmPlugin

| Name | Type | Description |
| ---- | ---- | ----------- |
| _fastTwapPeriod | uint32 |  |

### setRebalanceManager

```solidity
function setRebalanceManager(address _rebalanceManager) external
```
**Selector**: `0x918a1ab0`

@inheritdoc	IAlmPlugin

| Name | Type | Description |
| ---- | ---- | ----------- |
| _rebalanceManager | address |  |

