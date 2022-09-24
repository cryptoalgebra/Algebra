# QuickSwap contest details
- $47,500 USDC main award pot
- $2,500 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-09-quickswap-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts September 26, 2022 20:00 UTC
- Ends October 01, 2022 20:00 UTC

<p align="center">
  <a href="https://algebra.finance/"><img alt="Algebra" src="logo.svg" width="360"></a>
</p>

<p align="center">
Innovative DEX with concentrated liquidity, adaptive fee, build-in farming etc.
</p>

## Building and Testing
 
- [Build](#Build)
- [Tests](#Tests)
- [Coverage](#Tests-coverage)
- [Deploy](#Deploy)


### Build

*Requires npm >= 8.0.0*

To install dependencies, you need to run the command in the root directory:
```
$ npm run bootstrap
```
This will download and install dependencies and set up husky hooks.



To compile, you need to run the following command in the src/core folder:
```
$ npm run compile
```


### Tests

Tests are run by the following command in the src/core folder:
```
$ npm run test
```

### Tests coverage

To get a test coverage, you need to run the following command in the src/core folder:

```
$ npm run coverage
```

### Deploy
Firstly you need to create `.env` file in the root directory of project as in `env.example`.

To deploy in specific network:
```
$ node scripts/deployAll.js <network>
```

## Links

- **Docs** : https://docs.algebra.finance/docs/intro
- **Tech Paper** : https://algebra.finance/static/Algerbra%20Tech%20Paper-15411d15f8653a81d5f7f574bfe655ad.pdf


## Scope
|File|SLOC|Coverage|
|:-|:-:|:-:|
|_Contracts (10)_|
|[src/core/contracts/AlgebraFactory.sol](https://github.com/code-423n4/2022-09-quickswap/blob/main/src/core/contracts/AlgebraFactory.sol)|83|100%|
|[src/core/contracts/AlgebraPool.sol](https://github.com/code-423n4/2022-09-quickswap/blob/main/src/core/contracts/AlgebraPool.sol)|789|100%|
|[src/core/contracts/AlgebraPoolDeployer.sol](https://github.com/code-423n4/2022-09-quickswap/blob/main/src/core/contracts/AlgebraPoolDeployer.sol)|40|100%|
|[src/core/contracts/DataStorageOperator.sol](https://github.com/code-423n4/2022-09-quickswap/blob/main/src/core/contracts/DataStorageOperator.sol)|127|96.55%|
|[src/core/contracts/libraries/AdaptiveFee.sol](https://github.com/code-423n4/2022-09-quickswap/blob/main/src/core/contracts/libraries/AdaptiveFee.soll)|74|97.37%|
|[src/core/contracts/libraries/DataStorage.sol.sol](https://github.com/code-423n4/2022-09-quickswap/blob/main/src/core/contracts/libraries/DataStorage.sol.soll)|271|94.29%|
|[src/core/contracts/libraries/PriceMovementMath.sol](https://github.com/code-423n4/2022-09-quickswap/blob/main/src/core/contracts/libraries/PriceMovementMath.sol)|143|98.11%|
|[src/core/contracts/libraries/TickManager.sol](https://github.com/code-423n4/2022-09-quickswap/blob/main/src/core/contracts/libraries/TickManager.sol)|95|100%|
|[src/core/contracts/libraries/TickTable.sol](https://github.com/code-423n4/2022-09-quickswap/blob/main/src/core/contracts/libraries/TickTable.sol)|94|100%|
|[src/core/contracts/libraries/TokenDeltaMath.sol.sol](https://github.com/code-423n4/2022-09-quickswap/blob/main/src/core/contracts/libraries/TokenDeltaMath.sol.sol)|50|100%|
|_Abstracts (2)_|
|[src/core/contracts/base/src/PoolImmutables.sol](https://github.com/code-423n4/2022-09-quickswap/blob/main/src/core/contracts/base/src/PoolImmutables.sol)|19|-|
[src/core/contracts/base/src/PoolState.sol](https://github.com/code-423n4/2022-09-quickswap/blob/main/src/core/contracts/base/src/PoolState.sol)|32|-|
|Total (over 12 files):|1817|98.86%|

## Contracts purpose

### src/core/contracts/AlgebraFactory.sol
Deploys pools and data storages, manages ownership and dynamic fee configuration
### src/core/contracts/AlgebraPool.sol
Main contract of pair with concentrated liquidity and dynamical fee. It contains the logic of swaps, liquidity providing, flash loans. Allows you to swap deflationary tokens and has protection from  “Just-In-Time”  liquidity providing
### src/core/contracts/AlgebraPoolDeployer.sol
A contract that constructs a pool must implement this to pass arguments to the pool. This is used to avoid having constructor arguments in the pool contract, which results in the init code hash of the pool being constant allowing the CREATE2 address of the pool to be cheaply computed on-chain
### src/core/contracts/DataStorageOperator.sol
This contract is used for interacting with DataStorage library
### src/core/contracts/libraries/AdaptiveFee.sol
Calculates fee based on combination of sigmoids
### src/core/contracts/libraries/DataStorage.sol.sol
DataStorage provides price, liquidity, volatility data useful for a wide variety of system designs. Mainly used to calculate dynamic fee. Instances of stored dataStorage data, "timepoints", are collected in the dataStorage array Timepoints are overwritten when the full length of the dataStorage array is populated. The most recent timepoint is available by passing 0 to getSingleTimepoint()
### src/core/contracts/libraries/PriceMovementMath.sol
Library that used for computing the result of a swap
### src/core/contracts/libraries/TickManager.sol
Library for managing tick processes and relevant calculations
### src/core/contracts/libraries/TickTable.sol
Packed tick initialized state library. Stores a packed mapping of tick index to its initialized state. The mapping uses int16 for keys since ticks are represented as int24 and there are 256 (2^8) values per word
### src/core/contracts/libraries/TokenDeltaMath.sol
TokenDeltaMath contains the math that uses square root of price as a Q64.96 and liquidity to compute deltas

## Areas to focus on