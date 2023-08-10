

# AlgebraInterfaceMulticall




A fork of Multicall2 specifically tailored for the Algebra Interface

*Developer note: Credit to Uniswap Labs under GPL-2.0-or-later license:
https://github.com/Uniswap/v3-periphery*


## Functions
### getCurrentBlockTimestamp


```solidity
function getCurrentBlockTimestamp() public view returns (uint256 timestamp)
```



**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| timestamp | uint256 |  |

### getEthBalance


```solidity
function getEthBalance(address addr) public view returns (uint256 balance)
```



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



| Name | Type | Description |
| ---- | ---- | ----------- |
| calls | struct AlgebraInterfaceMulticall.Call[] |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| blockNumber | uint256 |  |
| returnData | struct AlgebraInterfaceMulticall.Result[] |  |

