

# AlgebraOracleV1TWAP


Algebra base plugin V1 oracle frontend

Provides data from oracle corresponding pool

*Developer note: These functions are not very gas efficient and it is better not to use them on-chain*

**Inherits:** [IAlgebraOracleV1TWAP](IAlgebraOracleV1TWAP.md)

## Public variables
### pluginFactory
```solidity
address immutable pluginFactory
```
**Selector**: `0xe2a1bd59`

The address of the factory of plugins that are used as oracles by this contract



## Functions
### constructor

```solidity
constructor(address _pluginFactory) public
```



| Name | Type | Description |
| ---- | ---- | ----------- |
| _pluginFactory | address |  |

### getQuoteAtTick

```solidity
function getQuoteAtTick(int24 tick, uint128 baseAmount, address baseToken, address quoteToken) external pure returns (uint256 quoteAmount)
```
**Selector**: `0x43c57a27`

Given a tick and a token amount, calculates the amount of token received in exchange

*Developer note: Should not be used as quote for swap*

| Name | Type | Description |
| ---- | ---- | ----------- |
| tick | int24 | Tick value used to calculate the quote |
| baseAmount | uint128 | Amount of token to be converted |
| baseToken | address | Address of an ERC20 token contract used as the baseAmount denomination |
| quoteToken | address | Address of an ERC20 token contract used as the quoteAmount denomination |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| quoteAmount | uint256 | Amount of quoteToken received for baseAmount of baseToken |

### getAverageTick

```solidity
function getAverageTick(address pool, uint32 period) external view returns (int24 timeWeightedAverageTick, bool isConnected)
```
**Selector**: `0x57f32330`

Fetches time-weighted average tick using Algebra VolatilityOracle

*Developer note: Oracle may stop receiving data from the pool (be disconnected). For that reason it is important
not to rely on the absolute accuracy and availability at any time of this oracle.
It is recommended to check the latest available timestamp using the &#x60;latestTimestamp&#x60; method and don&#x27;t use the data if the last entry is too old*

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The address of Algebra Integral pool |
| period | uint32 | Number of seconds in the past to start calculating time-weighted average |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| timeWeightedAverageTick | int24 | The time-weighted average tick from (block.timestamp - period) to block.timestamp |
| isConnected | bool | Is oracle currently connected to the pool. If disconnected data can be obsolete |

### latestTimestamp

```solidity
function latestTimestamp(address pool) external view returns (uint32)
```
**Selector**: `0x59dd1ce6`

Returns the last timestamp written in the oracle

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint32 |  |

### oldestTimestamp

```solidity
function oldestTimestamp(address pool) external view returns (uint32 _oldestTimestamp)
```
**Selector**: `0x42c7d5bf`

Returns the oldest timestamp available in the oracle

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _oldestTimestamp | uint32 |  |

### latestIndex

```solidity
function latestIndex(address pool) external view returns (uint16)
```
**Selector**: `0x057e9b96`

Returns the index of last record written in the oracle

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint16 |  |

### isOracleConnected

```solidity
function isOracleConnected(address pool) external view returns (bool connected)
```
**Selector**: `0x9905d9a5`

Whether or not the oracle is connected to the liquidity pool

*Developer note: Oracle should not be used if disconnected from pool*

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| connected | bool |  |

### oldestIndex

```solidity
function oldestIndex(address pool) external view returns (uint16 _oldestIndex)
```
**Selector**: `0x4a2b7c70`

Returns the index of oldest record available in the oracle

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| _oldestIndex | uint16 |  |

