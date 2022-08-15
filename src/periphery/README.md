# Algebra Periphery

This directory contains the periphery smart contracts for the Algebra DEX. For the lower level core contracts, see the `core` directory.

## Slither

*Relevant for Slither 0.8.3*

To run slither for periphery you need to exclude `delegatecall-loop` and `msg-value-loop` detectors:
```
$ slither . --exclude delegatecall-loop,msg-value-loop
```
Or exclude contracts in `base` folder. Otherwise Slither crashes with an error.

## License

Smart contracts of the periphery are based on [UniswapV3 periphery](https://github.com/Uniswap/v3-periphery) and retain the GPL-2.0 or later license.

Contracts have been changed in some places to be compatible with the Algebra Core and use its unique functionality.
