# AlgebraFeeConfiguration

coefficients for sigmoids: α / (1 + e^( (β-x) / γ))

*Developer note: alpha1 + alpha2 + baseFee must be &lt;&#x3D; type(uint16).max*

```solidity
struct AlgebraFeeConfiguration {
  uint16 alpha1;
  uint16 alpha2;
  uint32 beta1;
  uint32 beta2;
  uint16 gamma1;
  uint16 gamma2;
  uint16 baseFee;
}
```
