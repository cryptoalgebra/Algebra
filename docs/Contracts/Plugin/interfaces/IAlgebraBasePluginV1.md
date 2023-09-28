

# IAlgebraBasePluginV1


The interface for the AlgebraBasePluginV1

This contract combines the standard implementations of the volatility oracle and the dynamic fee manager

*Developer note: This contract stores timepoints and calculates adaptive fee and statistical averages*

**Inherits:** IVolatilityOracle IDynamicFeeManager IFarmingPlugin

## Functions
### initialize

```solidity
function initialize() external
```
**Selector**: `0x8129fc1c`

Initialize the plugin externally

*Developer note: This function allows to initialize the plugin if it was created after the pool was created*

