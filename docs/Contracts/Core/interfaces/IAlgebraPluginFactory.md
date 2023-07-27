

# IAlgebraPluginFactory


An interface for a contract that is capable of deploying Algebra plugins



*Developer note: Such a factory is needed if the plugin should be automatically created and connected to each new pool*


## Functions
### createPlugin


```solidity
function createPlugin(address pool) external returns (address)
```

Deploys new plugin contract for pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| pool | address | The address of the pool for which the new plugin will be created |

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | New plugin address |

