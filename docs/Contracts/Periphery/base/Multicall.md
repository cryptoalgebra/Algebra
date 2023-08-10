

# Multicall


Multicall

Enables calling multiple methods in a single call to the contract


## Functions
### multicall

```solidity
function multicall(bytes[] data) external payable returns (bytes[] results)
```

Call multiple functions in the current contract and return the data from all of them if they all succeed

*Developer note: The &#x60;msg.value&#x60; should not be trusted for any method callable from multicall.*

| Name | Type | Description |
| ---- | ---- | ----------- |
| data | bytes[] | The encoded function data for each of the calls to make to this contract |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| results | bytes[] | The results from each of the calls passed in via data |

