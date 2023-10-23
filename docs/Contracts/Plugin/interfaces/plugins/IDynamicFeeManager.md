

# IDynamicFeeManager


The interface for the Algebra dynamic fee manager



*Developer note: This contract calculates adaptive fee*

**Inherits:** [IAlgebraDynamicFeePlugin](../../../Core/interfaces/plugin/IAlgebraDynamicFeePlugin.md)

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
### feeConfig

```solidity
function feeConfig() external view returns (uint16 alpha1, uint16 alpha2, uint32 beta1, uint32 beta2, uint16 gamma1, uint16 gamma2, uint16 baseFee)
```
**Selector**: `0x1e5eb1d0`

Current dynamic fee configuration

*Developer note: See the AdaptiveFee struct for more details*

**Returns:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| alpha1 | uint16 |  |
| alpha2 | uint16 |  |
| beta1 | uint32 |  |
| beta2 | uint32 |  |
| gamma1 | uint16 |  |
| gamma2 | uint16 |  |
| baseFee | uint16 |  |

### changeFeeConfiguration

```solidity
function changeFeeConfiguration(struct AlgebraFeeConfiguration feeConfig) external
```
**Selector**: `0x1d39215e`

Changes fee configuration for the pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| feeConfig | struct AlgebraFeeConfiguration |  |

