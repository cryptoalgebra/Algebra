

# DynamicFeePlugin


Algebra Integral 1.2.2 default plugin

This contract stores timepoints and calculates adaptive fee and statistical averages

**Inherits:** AlgebraBasePlugin [IDynamicFeeManager](../interfaces/plugins/IDynamicFeeManager.md)

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
function changeFeeConfiguration(struct AlgebraFeeConfiguration _config) external
```
**Selector**: `0x1d39215e`

Changes fee configuration for the pool

| Name | Type | Description |
| ---- | ---- | ----------- |
| _config | struct AlgebraFeeConfiguration |  |

