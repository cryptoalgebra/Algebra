

# AlgebraInterfaceMulticall


A fork of Multicall2 specifically tailored for the Algebra Interface




## Functions
### getCurrentBlockTimestamp


`getCurrentBlockTimestamp()` view public






**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| timestamp | uint256 |  |

### getEthBalance


`getEthBalance(address)` view public





| Name | Type | Description |
| ---- | ---- | ----------- |
| addr | address |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| balance | uint256 |  |

### multicall


`multicall(struct AlgebraInterfaceMulticall.Call[])`  public





| Name | Type | Description |
| ---- | ---- | ----------- |
| calls | struct AlgebraInterfaceMulticall.Call[] |  |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| blockNumber | uint256 |  |
| returnData | struct AlgebraInterfaceMulticall.Result[] |  |



---


