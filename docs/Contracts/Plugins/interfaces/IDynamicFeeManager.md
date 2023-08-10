

# IDynamicFeeManager


The interface for the Algebra dynamic fee manager



*Developer note: This contract calculates adaptive fee*


## Events
### FeeConfiguration


```solidity
event FeeConfiguration(struct AlgebraFeeConfiguration feeConfig)
```

Emitted when the fee configuration is changed

*Developer note: See the AdaptiveFee struct for more details*

| Name | Type | Description |
| ---- | ---- | ----------- |
| feeConfig | struct AlgebraFeeConfiguration | The structure with dynamic fee parameters |


## Functions
### changeFeeConfiguration


```solidity
function changeFeeConfiguration(struct AlgebraFeeConfiguration feeConfig) external
```

Changes fee configuration for the pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| feeConfig | struct AlgebraFeeConfiguration |  |

