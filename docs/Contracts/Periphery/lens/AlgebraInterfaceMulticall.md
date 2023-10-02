

# AlgebraInterfaceMulticall




A fork of Multicall2 specifically tailored for the Algebra Interface

*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-periphery*


## Structs
### Call



```solidity
struct Call {
  address target;
  uint256 gasLimit;
  bytes callData;
}
```

### Result



```solidity
struct Result {
  bool success;
  uint256 gasUsed;
  bytes returnData;
}
```


## Functions
### getCurrentBlockTimestamp

```solidity
function getCurrentBlockTimestamp() public view returns (uint256 timestamp)
```
**Selector**: `0x0f28c97d`



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| timestamp | uint256 |  |

### getEthBalance

```solidity
function getEthBalance(address addr) public view returns (uint256 balance)
```
**Selector**: `0x4d2301cc`



| Name | Type | Description |
| ---- | ---- | ----------- |
| addr | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| balance | uint256 |  |

### multicall

```solidity
function multicall(struct AlgebraInterfaceMulticall.Call[] calls) public returns (uint256 blockNumber, struct AlgebraInterfaceMulticall.Result[] returnData)
```
**Selector**: `0x1749e1e3`



| Name | Type | Description |
| ---- | ---- | ----------- |
| calls | struct AlgebraInterfaceMulticall.Call[] |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| blockNumber | uint256 |  |
| returnData | struct AlgebraInterfaceMulticall.Result[] |  |

