

# AlgebraInterfaceMulticall3




A fork of Multicall3 specifically tailored for the Algebra Interface

*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:*


## Structs
### Call



```solidity
struct Call {
  address target;
  bytes callData;
}
```

### Call3



```solidity
struct Call3 {
  address target;
  bool allowFailure;
  bytes callData;
}
```

### Call3Value



```solidity
struct Call3Value {
  address target;
  bool allowFailure;
  uint256 value;
  bytes callData;
}
```

### Result



```solidity
struct Result {
  bool success;
  bytes returnData;
}
```


## Functions
### aggregate

```solidity
function aggregate(struct AlgebraInterfaceMulticall3.Call[] calls) public payable returns (uint256 blockNumber, bytes[] returnData)
```
**Selector**: `0x252dba42`

Backwards-compatible call aggregation with Multicall

| Name | Type | Description |
| ---- | ---- | ----------- |
| calls | struct AlgebraInterfaceMulticall3.Call[] | An array of Call structs |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| blockNumber | uint256 | The block number where the calls were executed |
| returnData | bytes[] | An array of bytes containing the responses |

### tryAggregate

```solidity
function tryAggregate(bool requireSuccess, struct AlgebraInterfaceMulticall3.Call[] calls) public payable returns (struct AlgebraInterfaceMulticall3.Result[] returnData)
```
**Selector**: `0xbce38bd7`

Backwards-compatible with Multicall2
Aggregate calls without requiring success

| Name | Type | Description |
| ---- | ---- | ----------- |
| requireSuccess | bool | If true, require all calls to succeed |
| calls | struct AlgebraInterfaceMulticall3.Call[] | An array of Call structs |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| returnData | struct AlgebraInterfaceMulticall3.Result[] | An array of Result structs |

### tryBlockAndAggregate

```solidity
function tryBlockAndAggregate(bool requireSuccess, struct AlgebraInterfaceMulticall3.Call[] calls) public payable returns (uint256 blockNumber, bytes32 blockHash, struct AlgebraInterfaceMulticall3.Result[] returnData)
```
**Selector**: `0x399542e9`

Backwards-compatible with Multicall2
Aggregate calls and allow failures using tryAggregate

| Name | Type | Description |
| ---- | ---- | ----------- |
| requireSuccess | bool |  |
| calls | struct AlgebraInterfaceMulticall3.Call[] | An array of Call structs |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| blockNumber | uint256 | The block number where the calls were executed |
| blockHash | bytes32 | The hash of the block where the calls were executed |
| returnData | struct AlgebraInterfaceMulticall3.Result[] | An array of Result structs |

### blockAndAggregate

```solidity
function blockAndAggregate(struct AlgebraInterfaceMulticall3.Call[] calls) public payable returns (uint256 blockNumber, bytes32 blockHash, struct AlgebraInterfaceMulticall3.Result[] returnData)
```
**Selector**: `0xc3077fa9`

Backwards-compatible with Multicall2
Aggregate calls and allow failures using tryAggregate

| Name | Type | Description |
| ---- | ---- | ----------- |
| calls | struct AlgebraInterfaceMulticall3.Call[] | An array of Call structs |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| blockNumber | uint256 | The block number where the calls were executed |
| blockHash | bytes32 | The hash of the block where the calls were executed |
| returnData | struct AlgebraInterfaceMulticall3.Result[] | An array of Result structs |

### aggregate3

```solidity
function aggregate3(struct AlgebraInterfaceMulticall3.Call3[] calls) public payable returns (struct AlgebraInterfaceMulticall3.Result[] returnData)
```
**Selector**: `0x82ad56cb`

Aggregate calls, ensuring each returns success if required

| Name | Type | Description |
| ---- | ---- | ----------- |
| calls | struct AlgebraInterfaceMulticall3.Call3[] | An array of Call3 structs |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| returnData | struct AlgebraInterfaceMulticall3.Result[] | An array of Result structs |

### aggregate3Value

```solidity
function aggregate3Value(struct AlgebraInterfaceMulticall3.Call3Value[] calls) public payable returns (struct AlgebraInterfaceMulticall3.Result[] returnData)
```
**Selector**: `0x174dea71`

Aggregate calls with a msg value
Reverts if msg.value is less than the sum of the call values

| Name | Type | Description |
| ---- | ---- | ----------- |
| calls | struct AlgebraInterfaceMulticall3.Call3Value[] | An array of Call3Value structs |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| returnData | struct AlgebraInterfaceMulticall3.Result[] | An array of Result structs |

### getBlockHash

```solidity
function getBlockHash(uint256 blockNumber) public view returns (bytes32 blockHash)
```
**Selector**: `0xee82ac5e`

Returns the block hash for the given block number

| Name | Type | Description |
| ---- | ---- | ----------- |
| blockNumber | uint256 | The block number |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| blockHash | bytes32 |  |

### getBlockNumber

```solidity
function getBlockNumber() public view returns (uint256 blockNumber)
```
**Selector**: `0x42cbb15c`

Returns the block number

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| blockNumber | uint256 |  |

### getCurrentBlockCoinbase

```solidity
function getCurrentBlockCoinbase() public view returns (address coinbase)
```
**Selector**: `0xa8b0574e`

Returns the block coinbase

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| coinbase | address |  |

### getCurrentBlockDifficulty

```solidity
function getCurrentBlockDifficulty() public view returns (uint256 difficulty)
```
**Selector**: `0x72425d9d`

Returns the block difficulty

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| difficulty | uint256 |  |

### getCurrentBlockGasLimit

```solidity
function getCurrentBlockGasLimit() public view returns (uint256 gaslimit)
```
**Selector**: `0x86d516e8`

Returns the block gas limit

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| gaslimit | uint256 |  |

### getCurrentBlockTimestamp

```solidity
function getCurrentBlockTimestamp() public view returns (uint256 timestamp)
```
**Selector**: `0x0f28c97d`

Returns the block timestamp

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| timestamp | uint256 |  |

### getEthBalance

```solidity
function getEthBalance(address addr) public view returns (uint256 balance)
```
**Selector**: `0x4d2301cc`

Returns the (ETH) balance of a given address

| Name | Type | Description |
| ---- | ---- | ----------- |
| addr | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| balance | uint256 |  |

### getLastBlockHash

```solidity
function getLastBlockHash() public view returns (bytes32 blockHash)
```
**Selector**: `0x27e86d6e`

Returns the block hash of the last block

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| blockHash | bytes32 |  |

### getBasefee

```solidity
function getBasefee() public view returns (uint256 basefee)
```
**Selector**: `0x3e64a696`

Gets the base fee of the given block
Can revert if the BASEFEE opcode is not implemented by the given chain

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| basefee | uint256 |  |

### getChainId

```solidity
function getChainId() public view returns (uint256 chainid)
```
**Selector**: `0x3408e470`

Returns the chain id

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| chainid | uint256 |  |

