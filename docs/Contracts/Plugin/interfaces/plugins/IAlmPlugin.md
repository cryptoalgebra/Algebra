

# IAlmPlugin







## Functions
### initializeALM

```solidity
function initializeALM(address _rebalanceManager, uint32 _slowTwapPeriod, uint32 _fastTwapPeriod) external
```
**Selector**: `0xd49dda85`

Initializing ALM plugin

| Name | Type | Description |
| ---- | ---- | ----------- |
| _rebalanceManager | address | address of rebalance manager |
| _slowTwapPeriod | uint32 | period in seconds to get slow TWAP |
| _fastTwapPeriod | uint32 | period in seconds to get fast TWAP |

### setSlowTwapPeriod

```solidity
function setSlowTwapPeriod(uint32 _slowTwapPeriod) external
```
**Selector**: `0x48b2acdd`

Set slow TWAP period

| Name | Type | Description |
| ---- | ---- | ----------- |
| _slowTwapPeriod | uint32 | period in seconds to get slow TWAP |

### setFastTwapPeriod

```solidity
function setFastTwapPeriod(uint32 _fastTwapPeriod) external
```
**Selector**: `0x08095141`

Set slow TWAP period

| Name | Type | Description |
| ---- | ---- | ----------- |
| _fastTwapPeriod | uint32 | period in seconds to get fast TWAP |

### setRebalanceManager

```solidity
function setRebalanceManager(address _rebalanceManager) external
```
**Selector**: `0x918a1ab0`

Set rebalance manager

| Name | Type | Description |
| ---- | ---- | ----------- |
| _rebalanceManager | address | address of rebalance manager |

### rebalanceManager

```solidity
function rebalanceManager() external view returns (address)
```
**Selector**: `0x6fb5bad1`

Returns address of rebalance manager

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | Address of rebalance manager |

### slowTwapPeriod

```solidity
function slowTwapPeriod() external view returns (uint32)
```
**Selector**: `0x841c6a37`

Returns time interval in seconds of slow TWAP period

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 | Time interval in seconds of slow TWAP period |

### fastTwapPeriod

```solidity
function fastTwapPeriod() external view returns (uint32)
```
**Selector**: `0xad1c3743`

Returns time interval in seconds of fast TWAP period

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 | Time interval in seconds of fast TWAP period |

